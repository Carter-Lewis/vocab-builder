import "server-only";
import { generateText, Output } from "ai";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, type Category, profiles, words } from "@/db/schema";
import { buildPrompt, candidateSchema } from "./daily-prompt";
import { lookupWord, pickMeaning } from "./dictionary";

// Gemini 2.5 Flash-Lite via AI Gateway: $0.10/M input, $0.40/M output, and on the
// gateway's free tier. One call a day at ~0.5k in / ~0.5k out ≈ $0.0002 → under 1¢ a month.
// Tested against gpt-5.4-nano; Flash-Lite calibrated difficulty to the level noticeably better.
export const DAILY_MODEL = "google/gemini-2.5-flash-lite";

// Hard cap on AI calls per user per rolling 24h (covers retries after failures).
// Worst case 6 × 30 days × ~$0.0002 ≈ 4¢/month; normally it's one call a day.
export const MAX_AI_CALLS_PER_DAY = 6;

// Roughly 1 in 3 daily words is humorous-but-usable.
const HUMOROUS_SHARE = 0.33;

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
      category: words.category,
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

  const daily = bank.filter((w) => w.source === "daily");
  const humorousShare = daily.length ? daily.filter((w) => w.category === "humorous").length / daily.length : 0;
  // Don't open with a humorous word, and never do two in a row.
  const lastWasHumorous = daily[0]?.category === "humorous";
  const category: Category =
    daily.length >= 1 && !lastWasHumorous && humorousShare < HUMOROUS_SHARE ? "humorous" : "practical";

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
    known: new Set(bank.map((w) => w.word.toLowerCase())),
    bankWords: bank.slice(0, 250).map((w) => w.word),
    category,
    domain,
    posCounts,
    struggles,
  };
}

/**
 * Asks the model for candidates, then verifies them against a real dictionary
 * and returns the first one that exists and isn't already in the bank.
 * Exactly one AI call per invocation.
 */
export async function pickDailyWord(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, since)));
  if (count >= MAX_AI_CALLS_PER_DAY) {
    throw new AiCapError("Daily AI limit reached");
  }

  const ctx = await buildContext(userId);

  // Log before the call so even a failed request counts toward the cap.
  const [usage] = await db.insert(aiUsage).values({ userId, model: DAILY_MODEL }).returning({ id: aiUsage.id });

  const { output, usage: tokens } = await generateText({
    model: DAILY_MODEL,
    output: Output.object({ schema: candidateSchema }),
    prompt: buildPrompt(ctx),
    maxOutputTokens: 1000,
    temperature: 0.9,
  });

  await db
    .update(aiUsage)
    .set({ inputTokens: tokens.inputTokens ?? null, outputTokens: tokens.outputTokens ?? null })
    .where(eq(aiUsage.id, usage.id));

  const fresh = output.candidates.filter((c) => {
    const w = c.word.trim().toLowerCase();
    return w && !w.includes(" ") && !ctx.known.has(w);
  });

  const reasons: string[] = [];
  let unverified: (typeof fresh)[number] | undefined;
  for (const c of fresh) {
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
    const meaning = pickMeaning(entry, c.partOfSpeech);
    return {
      word: entry.word,
      phonetic: entry.phonetic ?? null,
      audioUrl: entry.audioUrl ?? null,
      partOfSpeech: c.partOfSpeech,
      definition: c.definition,
      dictionaryDefinition: meaning.definition,
      example: c.example,
      category: ctx.category,
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
      category: ctx.category,
      domain: ctx.domain,
      why: unverified.why,
    };
  }
  throw new Error(`No candidate could be verified: ${reasons.join(" | ") || "all candidates already known"}`);
}
