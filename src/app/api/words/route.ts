import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { words } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  const rows = await db.select().from(words).where(eq(words.userId, userId)).orderBy(desc(words.createdAt));
  return NextResponse.json(rows);
}

const newWord = z.object({
  word: z.string().trim().min(1).max(60),
  definition: z.string().trim().min(1).max(500),
  partOfSpeech: z.string().trim().max(30).optional(),
  phonetic: z.string().trim().max(80).optional(),
  audioUrl: z.url().optional(),
  example: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const parsed = newWord.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Please fill in the word and a definition." }, { status: 400 });

  const [row] = await db
    .insert(words)
    .values({ ...parsed.data, userId, source: "manual" })
    .onConflictDoNothing()
    .returning();
  if (!row) return NextResponse.json({ error: "That word is already in your bank." }, { status: 409 });
  return NextResponse.json(row, { status: 201 });
}
