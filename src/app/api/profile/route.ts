import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { scorePlacement } from "@/lib/placement";

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  await db.insert(profiles).values({ userId }).onConflictDoNothing();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return NextResponse.json(profile);
}

const placementBody = z.object({
  results: z.array(z.object({ word: z.string(), correct: z.boolean() })).max(50),
  skip: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const parsed = placementBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { level, missed } = parsed.data.skip ? { level: 3, missed: [] } : scorePlacement(parsed.data.results);
  const values = { level, placementMissed: missed, placementDone: true };

  const [profile] = await db
    .insert(profiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: profiles.userId, set: values })
    .returning();
  return NextResponse.json(profile);
}
