import { and, asc, eq, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { type Word, words } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { FILLER_DEFINITIONS, FILLER_WORDS } from "@/lib/placement";
import { schedule } from "@/lib/srs";

const SESSION_SIZE = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(target: Word, bank: Word[]) {
  const others = shuffle(bank.filter((w) => w.id !== target.id));
  // Prefer distractors with the same part of speech — they're harder to rule out.
  const samePos = others.filter((w) => w.partOfSpeech === target.partOfSpeech);
  const pool = [...samePos, ...others.filter((w) => !samePos.includes(w))].slice(0, 3);

  // Alternate between "what does X mean?" and "which word means Y?"
  const mode = Math.random() < 0.5 ? "definition" : "word";
  const prompt = mode === "definition" ? target.word : target.definition;
  const answer = mode === "definition" ? target.definition : target.word;

  const distractors = pool.map((w) => (mode === "definition" ? w.definition : w.word));
  const filler = shuffle(mode === "definition" ? FILLER_DEFINITIONS : FILLER_WORDS);
  while (distractors.length < 3) {
    const f = filler.pop()!;
    if (f.toLowerCase() !== answer.toLowerCase()) distractors.push(f);
  }

  const options = shuffle([answer, ...distractors]);
  return {
    wordId: target.id,
    mode,
    prompt,
    partOfSpeech: target.partOfSpeech,
    options,
    answerIndex: options.indexOf(answer),
    word: target.word,
    definition: target.definition,
    example: target.example,
  };
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const practice = req.nextUrl.searchParams.get("practice") === "1";
  const bank = await db.select().from(words).where(eq(words.userId, userId));

  const due = practice
    ? shuffle(bank).slice(0, SESSION_SIZE)
    : await db
        .select()
        .from(words)
        .where(and(eq(words.userId, userId), lte(words.dueAt, new Date())))
        .orderBy(asc(words.dueAt))
        .limit(SESSION_SIZE);

  return NextResponse.json({
    bankSize: bank.length,
    questions: shuffle(due).map((w) => buildQuestion(w, bank)),
  });
}

const grade = z.object({ wordId: z.number().int(), correct: z.boolean(), practice: z.boolean().optional() });

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const parsed = grade.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { wordId, correct, practice } = parsed.data;

  const [w] = await db.select().from(words).where(and(eq(words.id, wordId), eq(words.userId, userId)));
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const counts = correct ? { correctCount: w.correctCount + 1 } : { incorrectCount: w.incorrectCount + 1 };
  // Practice rounds track accuracy (which feeds gap-finding) but don't move the schedule.
  const next = practice ? {} : schedule(w, correct);

  await db
    .update(words)
    .set({ ...counts, ...next, lastReviewedAt: new Date() })
    .where(eq(words.id, wordId));
  return NextResponse.json({ ok: true });
}
