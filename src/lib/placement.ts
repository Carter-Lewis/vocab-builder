// A fixed placement quiz: 6 tiers of difficulty, 3 words each. No AI involved.
export type PlacementQuestion = {
  word: string;
  tier: number;
  answer: string;
  distractors: [string, string, string];
};

export const PLACEMENT: PlacementQuestion[] = [
  // Tier 1 — common but precise
  { word: "candid", tier: 1, answer: "Truthful and straightforward; frank", distractors: ["Sweet or sugary", "Hidden from view", "Easily frightened"] },
  { word: "meticulous", tier: 1, answer: "Showing great attention to detail", distractors: ["Extremely tiny", "Done quickly and carelessly", "Related to the weather"] },
  { word: "reluctant", tier: 1, answer: "Unwilling and hesitant", distractors: ["Shiny and reflective", "Eager to help", "Returning again"] },
  // Tier 2
  { word: "pragmatic", tier: 2, answer: "Dealing with things sensibly and realistically", distractors: ["Overly emotional", "Based on ancient rules", "Talkative and boastful"] },
  { word: "ambivalent", tier: 2, answer: "Having mixed or contradictory feelings", distractors: ["Able to use both hands", "Moving in two directions", "Strongly in favor"] },
  { word: "kerfuffle", tier: 2, answer: "A commotion or fuss, especially over a minor issue", distractors: ["A small pastry", "A loose-fitting scarf", "A lucky accident"] },
  // Tier 3
  { word: "ubiquitous", tier: 3, answer: "Present or found everywhere", distractors: ["Extremely rare", "Impossible to understand", "Upside down"] },
  { word: "ephemeral", tier: 3, answer: "Lasting for a very short time", distractors: ["Relating to the sky", "Fragile like glass", "Spiritual or holy"] },
  { word: "magnanimous", tier: 3, answer: "Generous or forgiving, especially toward a rival", distractors: ["Enormous in size", "Magnetic and attractive", "Holding a grudge"] },
  // Tier 4
  { word: "obsequious", tier: 4, answer: "Excessively eager to please or obey", distractors: ["Hard to see", "Following in order", "Stubbornly resistant"] },
  { word: "laconic", tier: 4, answer: "Using very few words", distractors: ["Lacking energy", "Milky in color", "Full of holes"] },
  { word: "perfunctory", tier: 4, answer: "Carried out with minimal effort or care", distractors: ["Absolutely perfect", "Done ahead of time", "Required by law"] },
  // Tier 5
  { word: "pusillanimous", tier: 5, answer: "Showing a lack of courage; timid", distractors: ["Fond of cats", "Covered in fine hair", "Quick to anger"] },
  { word: "obstreperous", tier: 5, answer: "Noisy and difficult to control", distractors: ["Hidden and secretive", "Relating to childbirth", "Painfully slow"] },
  { word: "defenestrate", tier: 5, answer: "To throw someone or something out of a window", distractors: ["To remove a fence", "To strip of defenses", "To cut down a forest"] },
  // Tier 6
  { word: "tergiversate", tier: 6, answer: "To make conflicting or evasive statements; to equivocate", distractors: ["To turn one's back literally", "To speak three languages", "To clean thoroughly"] },
  { word: "perspicacious", tier: 6, answer: "Having keen insight and understanding", distractors: ["Sweating heavily", "Transparent like glass", "Constantly suspicious"] },
  { word: "sesquipedalian", tier: 6, answer: "Given to using long words", distractors: ["Walking on many feet", "Occurring every 150 years", "Shaped like a half-moon"] },
];

/** Level = highest tier where the user got at least 2 of 3, requiring the tier below too. */
export function scorePlacement(results: { word: string; correct: boolean }[]) {
  const byWord = new Map(results.map((r) => [r.word, r.correct]));
  let level = 1;
  for (let tier = 1; tier <= 6; tier++) {
    const qs = PLACEMENT.filter((q) => q.tier === tier);
    const right = qs.filter((q) => byWord.get(q.word)).length;
    if (right >= 2) level = tier;
    else break;
  }
  const missed = PLACEMENT.filter((q) => byWord.has(q.word) && !byWord.get(q.word)).map((q) => q.word);
  return { level: Math.min(6, Math.max(1, level)), missed };
}

// Fallback distractors for quizzes when the word bank is still tiny.
export const FILLER_DEFINITIONS = PLACEMENT.flatMap((q) => q.distractors);
export const FILLER_WORDS = ["quixotic", "lugubrious", "brouhaha", "salient", "cogent", "gregarious", "nonplussed", "flummox"];
