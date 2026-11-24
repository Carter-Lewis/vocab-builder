import { z } from "zod";

const LEVEL_LABELS: Record<number, string> = {
  1: "building a strong everyday vocabulary",
  2: "comfortable with everyday words, ready for more precise ones",
  3: "solid general vocabulary, ready for educated-adult words",
  4: "strong vocabulary; ready for sophisticated words that still come up regularly",
  5: "advanced vocabulary; ready for the harder words found in quality journalism and essays",
  6: "exceptional vocabulary; offer the most demanding words that educated people still actually use",
};

export const candidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        word: z.string().describe("A single English headword in its base dictionary form (e.g. 'waffle', not 'waffled'), lowercase"),
        partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb"]),
        definition: z.string().describe("Plain-English definition, under 20 words"),
        example: z.string().describe("A natural, modern example sentence using the word"),
        why: z
          .string()
          .describe("One sentence on what gap this fills and when the user would actually use it"),
      }),
    )
    .min(3)
    .max(15),
});

export type PromptContext = {
  level: number;
  placementMissed: string[];
  known: Set<string>;
  bankWords: string[];
  skippedWords: string[];
  domain: string;
  posCounts: Record<string, number>;
  struggles: string[];
};

export function buildPrompt(ctx: PromptContext) {
  const pos = Object.entries(ctx.posCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const unusedPlacement = ctx.placementMissed.filter((w) => !ctx.known.has(w));

  return `You choose one "word of the day" for a single adult learner who wants to fill real gaps in their vocabulary.

Learner level: ${ctx.level}/6 — ${LEVEL_LABELS[ctx.level]}.
Words already in their bank (never suggest these): ${ctx.bankWords.join(", ") || "(none yet)"}
Words they skipped (never suggest these): ${ctx.skippedWords.join(", ") || "(none)"}
Part-of-speech mix so far: ${pos || "(none yet)"} — favor whichever is underrepresented.
Words they keep getting wrong in review: ${ctx.struggles.join(", ") || "(none)"} — a word in a related area that sharpens the distinction could help.
Placement-test words they didn't know: ${unusedPlacement.join(", ") || "(none)"} — these are known gaps; suggest one only if it passes the usefulness test below.

Usefulness test — every word must pass all of these:
- It comes up regularly in current books, news, essays, meetings, or conversation.
- The learner could say it to a friend, or use it in an email, paper, or presentation, and be understood without sounding odd or showy.
- It says something more precisely than the simpler words they already use.
Never suggest silly or novelty words, archaic or literary curiosities, technical jargon, slang, or "impressive" words people rarely use (e.g. not 'snollygoster', 'kerfuffle', 'tergiversate', 'pulchritude', 'sesquipedalian'). Aim for the register of 'pragmatic', 'nuance', 'candid', 'mitigate', 'tenuous', 'exacerbate', 'obfuscate'; don't just repeat these examples.
Today's theme: ${ctx.domain}.

Usefulness comes first. Among words that pass the test, prefer ones the learner may not fully command at their level; never reach for a rarer word just to add difficulty.
Return 12 candidates, most useful first. Each must be a real dictionary headword (single word), with a plain definition, a natural example sentence, and why it fills a gap.`;
}
