import "server-only";

// Datamuse is free and keyless; `md=f` returns occurrences per million words of English text.
const DATAMUSE_API = "https://api.datamuse.com/words";

/** Occurrences per million words (0 if unattested), or null if the service couldn't be reached. */
export async function wordFrequency(word: string): Promise<number | null> {
  const clean = word.trim().toLowerCase();
  try {
    const res = await fetch(`${DATAMUSE_API}?${new URLSearchParams({ sp: clean, qe: "sp", md: "f", max: "1" })}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { word: string; tags?: string[] }[];
    const tags = data.find((d) => d.word.toLowerCase() === clean)?.tags ?? [];
    const f = Number(tags.find((t) => t.startsWith("f:"))?.slice(2) ?? 0);
    return Number.isFinite(f) ? f : 0;
  } catch {
    return null;
  }
}
