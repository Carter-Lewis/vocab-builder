import "server-only";
import { generateText, Output } from "ai";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, profiles, skippedWords, words } from "@/db/schema";
import { buildPrompt, candidateSchema } from "./daily-prompt";
import { lookupWord, pickMeaning } from "./dictionary";
import { wordFrequency } from "./frequency";

// Gemini 2.5 Flash-Lite via AI Gateway: $0.10/M input, $0.40/M output, and on the
// gateway's free tier. One call a day at ~0.8k in / ~1.2k out ≈ $0.0006 → about 2¢ a month.
// Tested against gpt-5.4-nano; Flash-Lite calibrated difficulty to the level noticeably better.
export const DAILY_MODEL = "google/gemini-2.5-flash-lite";

// Hard cap on AI calls per user per rolling 24h (covers retries after failures).
// Worst case 6 × 30 days × ~$0.0006 ≈ 11¢/month; normally it's one call a day.
export const MAX_AI_CALLS_PER_DAY = 6;

// Replacing a known/skipped word stops this many calls short of the cap, so swapping
// late at night can't use up tomorrow's word.
const RESERVED_AI_CALLS = 2;

// Words rarer than this (per million words of English) are too obscure to be useful.
// For scale: pragmatic 5.9, ubiquitous 2.7, nuance 0.68, obfuscate 0.097 pass;
// equivocate 0.066, kerfuffle 0.005, tergiversate 0.0006 don't.
const MIN_FREQUENCY = 0.09;

const DOMAINS = [
  "emotions and inner states",
  "describing people's character",
  "social dynamics and relationships",
  "work and professional settings",
  "argument, reasoning, and persuasion",
  "speech and communication",
  "describing situations and events",
  "time, change, and progress",
  "degree, quantity, and intensity",
  "conflict and negotiation",
  "the senses, food, and the physical world",
  "money, value, and decisions",
];

export class AiCapError extends Error {}

async function buildContext(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const bank = await db
    .select({
      word: words.word,
      domain: words.domain,
      partOfSpeech: words.partOfSpeech,
      source: words.source,
      correct: words.correctCount,
      incorrect: words.incorrectCount,
      createdAt: words.createdAt,
    })
    .from(words)
    .where(eq(words.userId, userId))
    .orderBy(desc(words.createdAt));

  const skipped = (
    await db
      .select({ word: skippedWords.word })
      .from(skippedWords)
      .where(eq(skippedWords.userId, userId))
      .orderBy(desc(skippedWords.createdAt))
  ).map((s) => s.word);

  const daily = bank.filter((w) => w.source === "daily");

  // Rotate to the semantic domain least covered by recent daily words.
  const recentDomains = daily.slice(0, 24).map((w) => w.domain);
  const domain = [...DOMAINS].sort(
    (a, b) => recentDomains.filter((d) => d === a).length - recentDomains.filter((d) => d === b).length,
  )[0];

  const posCounts = bank.reduce<Record<string, number>>((acc, w) => {
    if (w.partOfSpeech) acc[w.partOfSpeech] = (acc[w.partOfSpeech] ?? 0) + 1;
    return acc;
  }, {});

  const struggles = bank
    .filter((w) => w.incorrect > w.correct)
    .slice(0, 12)
    .map((w) => w.word);

  return {
    level: profile?.level ?? 3,
    placementMissed: profile?.placementMissed ?? [],
    known: new Set([...bank.map((w) => w.word.toLowerCase()), ...skipped]),
    bankWords: bank.slice(0, 250).map((w) => w.word),
    skippedWords: skipped.slice(0, 100),
    domain,
    posCounts,
    struggles,
  };
}

async function aiCallsToday(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, since)));
  return count;
}

export async function canReplaceDailyWord(userId: string) {
  return (await aiCallsToday(userId)) < MAX_AI_CALLS_PER_DAY - RESERVED_AI_CALLS;
}

/**
 * Asks the model for candidates, then verifies them against a real dictionary
 * and real-world usage, returning the first that exists, is common enough to be
 * useful, and isn't already in the bank.
 * Exactly one AI call per invocation.
 */
export async function pickDailyWord(userId: string) {
  if ((await aiCallsToday(userId)) >= MAX_AI_CALLS_PER_DAY) {
    throw new AiCapError("Daily AI limit reached");
  }

  const ctx = await buildContext(userId);

  // Log before the call so even a failed request counts toward the cap.
  const [usage] = await db.insert(aiUsage).values({ userId, model: DAILY_MODEL }).returning({ id: aiUsage.id });

  const { output, usage: tokens } = await generateText({
    model: DAILY_MODEL,
    output: Output.object({ schema: candidateSchema }),
    prompt: buildPrompt(ctx),
    maxOutputTokens: 2500,
    temperature: 0.7,
  });

  await db
    .update(aiUsage)
    .set({ inputTokens: tokens.inputTokens ?? null, outputTokens: tokens.outputTokens ?? null })
    .where(eq(aiUsage.id, usage.id));

  const fresh = output.candidates.filter((c) => {
    const w = c.word.trim().toLowerCase();
    return w && !w.includes(" ") && !ctx.known.has(w);
  });

  const frequencies = await Promise.all(fresh.map((c) => wordFrequency(c.word)));

  const reasons: string[] = [];
  let unverified: (typeof fresh)[number] | undefined;
  for (const [i, c] of fresh.entries()) {
    // If the frequency service is down (null), rely on the prompt rather than lose the day's word.
    const frequency = frequencies[i];
    if (frequency !== null && frequency < MIN_FREQUENCY) {
      reasons.push(`${c.word}: too rare (${frequency}/M)`);
      continue;
    }
    const result = await lookupWord(c.word);
    if (result.status === "missing") {
      reasons.push(`${c.word}: not in dictionary`);
      continue;
    }
    if (result.status === "unavailable") {
      reasons.push(`${c.word}: ${result.reason}`);
      unverified ??= c;
      continue;
    }
    const { entry } = result;
    if (ctx.known.has(entry.word.toLowerCase())) {
      reasons.push(`${c.word}: already known`);
      continue;
    }
    const meaning = pickMeaning(entry, c.partOfSpeech);
    return {
      word: entry.word,
      phonetic: entry.phonetic ?? null,
      audioUrl: entry.audioUrl ?? null,
      partOfSpeech: c.partOfSpeech,
      definition: c.definition,
      dictionaryDefinition: meaning.definition,
      example: c.example,
      domain: ctx.domain,
      why: c.why,
    };
  }

  // If the dictionaries were unreachable (not "word doesn't exist"), don't waste
  // the AI call: use the model's top fresh candidate without a dictionary entry.
  if (unverified) {
    console.warn("[daily] dictionaries unavailable, using unverified word", reasons);
    return {
      word: unverified.word.trim().toLowerCase(),
      phonetic: null,
      audioUrl: null,
      partOfSpeech: unverified.partOfSpeech,
      definition: unverified.definition,
      dictionaryDefinition: null,
      example: unverified.example,
      domain: ctx.domain,
      why: unverified.why,
    };
  }
  throw new Error(`No candidate could be verified: ${reasons.join(" | ") || "all candidates already known"}`);
}
