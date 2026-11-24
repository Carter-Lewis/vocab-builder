"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Progress, QuizCard } from "@/components/quiz-card";
import { PLACEMENT } from "@/lib/placement";

type Q = { word: string; options: string[]; answerIndex: number; answer: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Placement() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  function begin() {
    // Easy to hard, so the quiz builds gently.
    setQuestions(
      PLACEMENT.map((q) => {
        const options = shuffle([q.answer, ...q.distractors]);
        return { word: q.word, options, answer: q.answer, answerIndex: options.indexOf(q.answer) };
      }),
    );
  }

  async function finish(body: object) {
    setSaving(true);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    router.replace("/");
  }

  if (!questions) {
    return (
      <div className="rise flex min-h-[80dvh] flex-col justify-center">
        <p className="font-serif text-lg text-ink-soft">wordwell</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight">
          One good word a day, chosen for you.
        </h1>
        <p className="mt-5 leading-relaxed text-ink-soft">
          Each day you&apos;ll get a word picked to fill a gap in your vocabulary — one you&apos;ll
          actually read, hear, and use. Every word lands in your bank and comes back for review just before you&apos;d
          forget it.
        </p>
        <p className="mt-4 leading-relaxed text-ink-soft">
          First, a quick 18-word check so your words start at the right level. Tap <em>Not sure</em> rather than
          guessing — it helps.
        </p>
        <button onClick={begin} className="mt-8 rounded-full bg-clay py-3.5 font-medium text-white active:scale-[0.99]">
          Start the check
        </button>
        <button
          onClick={() => finish({ results: [], skip: true })}
          disabled={saving}
          className="mt-3 py-2 text-sm text-muted"
        >
          Skip for now
        </button>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
        <p className="font-serif text-2xl">Finding your first word…</p>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Placement</span>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <div className="mt-3">
        <Progress value={index} total={questions.length} />
      </div>
      <div className="mt-10">
        <QuizCard
          key={q.word}
          eyebrow="What does this mean?"
          prompt={q.word}
          promptStyle="word"
          options={q.options}
          answerIndex={q.answerIndex}
          allowUnsure
          onDone={(correct) => {
            const next = [...results, { word: q.word, correct }];
            setResults(next);
            setIndex(index + 1);
            if (index + 1 >= questions.length) void finish({ results: next });
          }}
        />
      </div>
    </div>
  );
}
