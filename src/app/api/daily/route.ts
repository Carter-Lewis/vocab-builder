import { and, eq, lte, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { dailyWords, words } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AiCapError, pickDailyWord } from "@/lib/daily";

const STALE_PENDING_MS = 90_000;
const DAY_MS = 86_400_000;

function isPlausibleLocalDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(date + "T00:00:00Z");
  // Any real timezone is within ±14h of UTC, so allow a day either side.
  return !Number.isNaN(t) && Math.abs(t - Date.now()) <= 2 * DAY_MS;
}

async function dueCount(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(words)
    .where(and(eq(words.userId, userId), lte(words.dueAt, new Date())));
  return n;
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!isPlausibleLocalDate(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const key = and(eq(dailyWords.userId, userId), eq(dailyWords.date, date));
  const [existing] = await db.select().from(dailyWords).where(key);

  if (existing?.status === "ready") {
    const [word] = existing.wordId
      ? await db.select().from(words).where(and(eq(words.id, existing.wordId), eq(words.userId, userId)))
      : [];
    return NextResponse.json({ status: "ready", word: word ?? null, dueCount: await dueCount(userId) });
  }

  // Claim the slot so concurrent requests (two tabs, a retry) can't double-spend on AI.
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
  const claimed = existing
    ? await db
        .update(dailyWords)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(
            key,
            or(
              eq(dailyWords.status, "failed"),
              and(eq(dailyWords.status, "pending"), lte(dailyWords.updatedAt, staleBefore)),
            ),
          ),
        )
        .returning()
    : await db
        .insert(dailyWords)
        .values({ userId, date, status: "pending" })
        .onConflictDoNothing()
        .returning();

  if (claimed.length === 0) {
    return NextResponse.json({ status: "pending" }, { status: 202 });
  }

  try {
    const picked = await pickDailyWord(userId);
    // First review is tomorrow — today is for reading it.
    const [word] = await db
      .insert(words)
      .values({ ...picked, userId, source: "daily", dueAt: new Date(Date.now() + DAY_MS) })
      .returning();
    await db.update(dailyWords).set({ status: "ready", wordId: word.id, updatedAt: new Date() }).where(key);
    return NextResponse.json({ status: "ready", word, dueCount: await dueCount(userId) });
  } catch (e) {
    await db.update(dailyWords).set({ status: "failed", updatedAt: new Date() }).where(key);
    if (e instanceof AiCapError) {
      return NextResponse.json(
        { status: "failed", error: "Today's word limit was reached. Try again tomorrow." },
        { status: 429 },
      );
    }
    console.error("[daily] generation failed", e);
    return NextResponse.json(
      { status: "failed", error: "Couldn't find today's word. Try again in a moment." },
      { status: 500 },
    );
  }
}
