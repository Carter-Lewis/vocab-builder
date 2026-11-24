import type { Word } from "@/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MASTERED_INTERVAL_DAYS = 21;

export type WordStatus = "new" | "learning" | "mastered";

export function wordStatus(w: Pick<Word, "reps" | "intervalDays" | "correctCount" | "incorrectCount">): WordStatus {
  if (w.intervalDays >= MASTERED_INTERVAL_DAYS) return "mastered";
  if (w.correctCount === 0 && w.incorrectCount === 0) return "new";
  return "learning";
}

/** For a word the user already knew: starts mastered, with an occasional review to confirm it. */
export function scheduleKnown(now = new Date()) {
  return {
    reps: 3,
    intervalDays: MASTERED_INTERVAL_DAYS,
    dueAt: new Date(now.getTime() + MASTERED_INTERVAL_DAYS * DAY_MS),
  };
}

/** Simplified SM-2 for a pass/fail answer. */
export function schedule(w: Pick<Word, "ease" | "intervalDays" | "reps">, correct: boolean, now = new Date()) {
  if (!correct) {
    return {
      reps: 0,
      intervalDays: 0,
      ease: Math.max(1.3, w.ease - 0.2),
      // See it again later in the same session/day.
      dueAt: new Date(now.getTime() + 10 * 60 * 1000),
    };
  }
  const reps = w.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(w.intervalDays * w.ease);
  return {
    reps,
    intervalDays,
    ease: Math.min(2.8, w.ease + 0.05),
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
