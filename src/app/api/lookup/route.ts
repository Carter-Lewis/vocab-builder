import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { lookupWord } from "@/lib/dictionary";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const word = req.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > 60) return NextResponse.json({ error: "Enter a word" }, { status: 400 });

  const result = await lookupWord(word);
  if (result.status === "missing") return NextResponse.json({ error: "Not found in the dictionary" }, { status: 404 });
  if (result.status === "unavailable") {
    console.warn("[lookup] dictionaries unavailable", result.reason);
    return NextResponse.json({ error: "The dictionary is unreachable right now" }, { status: 503 });
  }
  return NextResponse.json(result.entry);
}
