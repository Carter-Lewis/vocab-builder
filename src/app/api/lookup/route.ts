import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { lookupWord } from "@/lib/dictionary";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const word = req.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > 60) return NextResponse.json({ error: "Enter a word" }, { status: 400 });

  const entry = await lookupWord(word);
  if (!entry) return NextResponse.json({ error: "Not found in the dictionary" }, { status: 404 });
  return NextResponse.json(entry);
}
