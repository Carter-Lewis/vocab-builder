import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { words } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const patch = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
  category: z.enum(["practical", "humorous"]).optional(),
  definition: z.string().trim().min(1).max(500).optional(),
  example: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/words/[id]">) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const id = Number((await ctx.params).id);

  const parsed = patch.safeParse(await req.json());
  if (!parsed.success || !Number.isInteger(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [row] = await db
    .update(words)
    .set(parsed.data)
    .where(and(eq(words.id, id), eq(words.userId, userId)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/words/[id]">) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const id = Number((await ctx.params).id);

  await db.delete(words).where(and(eq(words.id, id), eq(words.userId, userId)));
  return new NextResponse(null, { status: 204 });
}
