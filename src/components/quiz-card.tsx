"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Small label above the prompt, e.g. "What does this mean?" */
  eyebrow: string;
  prompt: string;
  /** Render the prompt in the large serif (for a single word) or as body text (for a definition). */
  promptStyle: "word" | "text";
  hint?: string | null;
  options: string[];
  answerIndex: number;
  allowUnsure?: boolean;
  /** Shown after answering, e.g. the example sentence. */
  reveal?: React.ReactNode;
  onDone: (correct: boolean) => void;
};

export function QuizCard({ eyebrow, prompt, promptStyle, hint, options, answerIndex, allowUnsure, reveal, onDone }: Props) {
  // null = unanswered, -1 = "not sure"
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;
  const continueRef = useRef<HTMLButtonElement>(null);

  // On a phone the Continue button often lands under the tab bar.
  useEffect(() => {
    if (answered) continueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [answered]);
  const correct = chosen === answerIndex;

  return (
    <div className="rise">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{eyebrow}</p>
      {promptStyle === "word" ? (
        <h2 className="mt-3 font-serif text-4xl tracking-tight">{prompt}</h2>
      ) : (
        <p className="mt-3 font-serif text-2xl leading-snug">{prompt}</p>
      )}
      {hint && <p className="mt-2 text-sm text-muted italic">{hint}</p>}

      <ul className="mt-7 space-y-2.5">
        {options.map((opt, i) => {
          const isAnswer = i === answerIndex;
          const isChosen = i === chosen;
          const style = !answered
            ? "border-line bg-surface active:bg-surface-2"
            : isAnswer
              ? "border-sage bg-sage-soft text-ink"
              : isChosen
                ? "border-danger/50 bg-surface text-ink-soft line-through decoration-danger/40"
                : "border-line bg-surface opacity-50";
          return (
            <li key={i}>
              <button
                disabled={answered}
                onClick={() => setChosen(i)}
                className={`w-full rounded-2xl border px-4 py-3.5 text-left leading-snug transition-colors ${style} ${
                  promptStyle === "text" ? "font-serif text-lg" : ""
                }`}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>

      {!answered && allowUnsure && (
        <button onClick={() => setChosen(-1)} className="mt-4 w-full py-2 text-sm text-muted">
          Not sure
        </button>
      )}

      {answered && (
        <div className="rise mt-6">
          <p className={`font-medium ${correct ? "text-sage" : "text-clay"}`}>
            {correct ? "Nicely done." : chosen === -1 ? "Now you know." : "Not quite — worth another look."}
          </p>
          {reveal}
          <button
            ref={continueRef}
            onClick={() => onDone(correct)}
            className="mt-5 w-full rounded-full bg-ink py-3.5 font-medium text-bg active:scale-[0.99]"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={value} aria-valuemax={total}>
      <div className="h-full rounded-full bg-clay transition-all duration-500" style={{ width: `${(value / total) * 100}%` }} />
    </div>
  );
}
