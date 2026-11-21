import { z } from "zod";
import type { Category } from "@/db/schema";

const LEVEL_LABELS: Record<number, string> = {
  1: "building a strong everyday vocabulary",
  2: "comfortable with everyday words, ready for more precise ones",
  3: "solid general vocabulary, ready for educated-adult words",
  4: "strong vocabulary; ready for sophisticated words",
  5: "advanced vocabulary; ready for rare but usable words",
  6: "exceptional vocabulary; only genuinely uncommon words will teach anything",
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
    .max(6),
});

export type PromptContext = {
  level: number;
  placementMissed: string[];
  known: Set<string>;
  bankWords: string[];
  category: Category;
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
Part-of-speech mix so far: ${pos || "(none yet)"} — favor whichever is underrepresented.
Words they keep getting wrong in review: ${ctx.struggles.join(", ") || "(none)"} — a word in a related area that sharpens the distinction could help.
Placement-test words they didn't know: ${unusedPlacement.join(", ") || "(none)"} — these are known gaps; you may suggest one directly.

Today's category: ${ctx.category.toUpperCase()}.
${
  ctx.category === "humorous"
    ? "Pick a delightfully funny-sounding or playful word that is still genuinely usable in conversation or writing (e.g. the register of 'kerfuffle', 'discombobulated', 'snollygoster', 'bumfuzzle', 'lollygag'). Not crude, not archaic to the point of uselessness."
    : "Pick a genuinely useful word a well-read adult would recognize and that lets the learner say something more precisely than they could before. Not jargon, not obscure for its own sake."
}
Today's theme: ${ctx.domain}.

Calibrate difficulty to the level: the word should be just beyond what they likely know.
Return 5 candidates, best first. Each must be a real dictionary headword (single word), with a plain definition, a natural example sentence, and why it fills a gap.`;
}
