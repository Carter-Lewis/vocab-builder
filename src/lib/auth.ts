import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Returns the signed-in user's id, or a 401 response to return directly. */
export async function requireUser(): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId };
}
