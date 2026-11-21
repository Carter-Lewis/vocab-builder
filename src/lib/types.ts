import type { Word as DbWord } from "@/db/schema";

// Words as they arrive over JSON (dates become strings).
export type Word = Omit<DbWord, "dueAt" | "lastReviewedAt" | "createdAt"> & {
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
};

export type Question = {
  wordId: number;
  mode: "definition" | "word";
  prompt: string;
  partOfSpeech: string | null;
  options: string[];
  answerIndex: number;
  word: string;
  definition: string;
  example: string | null;
};

export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function statusOf(w: Pick<Word, "intervalDays" | "correctCount" | "incorrectCount">) {
  if (w.intervalDays >= 21) return "mastered" as const;
  if (w.correctCount === 0 && w.incorrectCount === 0) return "new" as const;
  return "learning" as const;
}
