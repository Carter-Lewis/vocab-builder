import "server-only";

// Free Wiktionary-backed dictionary. No key, no cost.
const API = "https://api.dictionaryapi.dev/api/v2/entries/en/";

export type Meaning = { partOfSpeech: string; definition: string; example?: string };

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: Meaning[];
};

type ApiEntry = {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
};

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const clean = word.trim().toLowerCase();
  if (!clean) return null;

  let res: Response;
  try {
    res = await fetch(API + encodeURIComponent(clean), {
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as ApiEntry[];
  if (!Array.isArray(data) || data.length === 0) return null;

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
  if (meanings.length === 0) return null;

  return { word: data[0].word, phonetic, audioUrl, meanings };
}

/** Best dictionary definition for a given part of speech, if any. */
export function pickMeaning(entry: DictionaryEntry, partOfSpeech?: string): Meaning {
  const pos = partOfSpeech?.toLowerCase();
  return entry.meanings.find((m) => m.partOfSpeech.toLowerCase() === pos) ?? entry.meanings[0];
}
