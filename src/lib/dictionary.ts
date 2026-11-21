import "server-only";

// Primary: free Wiktionary-backed dictionary with phonetics and audio. It can
// reject requests from cloud IPs, so Wiktionary's own REST API is the fallback.
const DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const WIKTIONARY_API = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const USER_AGENT = "Wordwell/1.0 (personal vocabulary app; https://vocab-builder-eosin.vercel.app)";

export type Meaning = { partOfSpeech: string; definition: string; example?: string };

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: Meaning[];
};

/** "missing" means a dictionary answered that the word doesn't exist; "unavailable" means we couldn't ask. */
export type LookupResult =
  | { status: "found"; entry: DictionaryEntry }
  | { status: "missing" }
  | { status: "unavailable"; reason: string };

type ApiEntry = {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
};

type WiktionaryResponse = Record<
  string,
  {
    partOfSpeech: string;
    language: string;
    definitions: { definition: string; examples?: string[] }[];
  }[]
>;

async function get(url: string): Promise<Response | string> {
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    return e instanceof Error ? e.message : "network error";
  }
}

async function fromDictionaryApi(word: string): Promise<LookupResult> {
  const res = await get(DICTIONARY_API + encodeURIComponent(word));
  if (typeof res === "string") return { status: "unavailable", reason: `dictionaryapi: ${res}` };
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) return { status: "unavailable", reason: `dictionaryapi: HTTP ${res.status}` };

  let data: ApiEntry[];
  try {
    data = await res.json();
  } catch {
    return { status: "unavailable", reason: "dictionaryapi: non-JSON response" };
  }
  if (!Array.isArray(data) || data.length === 0) return { status: "missing" };

  const phonetics = data.flatMap((e) => e.phonetics ?? []);
  const phonetic = data.find((e) => e.phonetic)?.phonetic ?? phonetics.find((p) => p.text)?.text;
  // Prefer US audio when there's a choice.
  const audios = phonetics.map((p) => p.audio).filter((a): a is string => !!a);
  const audioUrl = audios.find((a) => a.includes("-us")) ?? audios[0];

  const meanings: Meaning[] = data.flatMap((e) =>
    (e.meanings ?? []).flatMap((m) =>
      m.definitions.slice(0, 3).map((d) => ({
        partOfSpeech: m.partOfSpeech,
        definition: d.definition,
        example: d.example,
      })),
    ),
  );
  if (meanings.length === 0) return { status: "missing" };
  return { status: "found", entry: { word: data[0].word, phonetic, audioUrl, meanings } };
}

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fromWiktionary(word: string): Promise<LookupResult> {
  const res = await get(WIKTIONARY_API + encodeURIComponent(word));
  if (typeof res === "string") return { status: "unavailable", reason: `wiktionary: ${res}` };
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) return { status: "unavailable", reason: `wiktionary: HTTP ${res.status}` };

  const data = (await res.json()) as WiktionaryResponse;
  const meanings: Meaning[] = (data.en ?? []).flatMap((section) =>
    section.definitions
      .map((d) => ({
        partOfSpeech: section.partOfSpeech.toLowerCase(),
        definition: stripHtml(d.definition),
        example: d.examples?.[0] ? stripHtml(d.examples[0]) : undefined,
      }))
      .filter((m) => m.definition)
      .slice(0, 3),
  );
  if (meanings.length === 0) return { status: "missing" };
  return { status: "found", entry: { word, meanings } };
}

export async function lookupWord(word: string): Promise<LookupResult> {
  const clean = word.trim().toLowerCase();
  if (!clean) return { status: "missing" };

  const primary = await fromDictionaryApi(clean);
  if (primary.status === "found") return primary;

  // Either the primary is unreachable, or it simply lacks the word — Wiktionary covers more.
  const fallback = await fromWiktionary(clean);
  if (fallback.status === "found") return fallback;
  if (primary.status === "missing" || fallback.status === "missing") return { status: "missing" };
  return { status: "unavailable", reason: `${primary.reason}; ${fallback.reason}` };
}

/** Best dictionary definition for a given part of speech, if any. */
export function pickMeaning(entry: DictionaryEntry, partOfSpeech?: string): Meaning {
  const pos = partOfSpeech?.toLowerCase();
  return entry.meanings.find((m) => m.partOfSpeech.toLowerCase() === pos) ?? entry.meanings[0];
}
