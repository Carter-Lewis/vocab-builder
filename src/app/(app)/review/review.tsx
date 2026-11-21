"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Progress, QuizCard } from "@/components/quiz-card";
import type { Question } from "@/lib/types";

type Session = { questions: Question[]; bankSize: number; practice: boolean };

export function Review() {
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);

  const start = useCallback(async (practice: boolean) => {
    setSession(null);
    const data = await fetch(`/api/review${practice ? "?practice=1" : ""}`).then((r) => r.json());
    setIndex(0);
    setScore(0);
    setSession({ ...data, practice });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kick off the initial fetch
    void start(false);
  }, [start]);

  if (!session) {
    return (
      <div className="pt-6">
        <Header />
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  const { questions, bankSize, practice } = session;

  if (questions.length === 0) {
    return (
      <div className="pt-6">
        <Header />
        <div className="mt-10 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-serif text-2xl">All caught up.</p>
          <p className="mt-2 text-ink-soft">
            {bankSize === 0 ? "Words appear here a day after you learn them." : "Nothing is due right now. Words come back just before you'd forget them."}
          </p>
          {bankSize > 0 && (
            <button onClick={() => start(true)} className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">
              Practice anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="pt-6">
        <Header />
        <div className="rise mt-10 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-serif text-5xl text-clay">
            {score}/{questions.length}
          </p>
          <p className="mt-3 text-ink-soft">
            {score === questions.length ? "A clean sweep." : "Missed words will come back sooner."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft">
              Done
            </Link>
            <button onClick={() => start(true)} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">
              Practice more
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="pt-6">
      <Header practice={practice} />
      <div className="mt-4">
        <Progress value={index} total={questions.length} />
      </div>
      <div className="mt-8">
        <QuizCard
          key={`${q.wordId}-${index}`}
          eyebrow={q.mode === "definition" ? "What does this mean?" : "Which word fits?"}
          prompt={q.prompt}
          promptStyle={q.mode === "definition" ? "word" : "text"}
          hint={q.mode === "definition" ? q.partOfSpeech : null}
          options={q.options}
          answerIndex={q.answerIndex}
          reveal={
            <div className="mt-3 rounded-2xl bg-surface p-4">
              <p>
                <span className="font-serif text-lg">{q.word}</span>
                <span className="text-ink-soft"> — {q.definition}</span>
              </p>
              {q.example && <p className="mt-2 font-serif text-ink-soft italic">“{q.example}”</p>}
            </div>
          }
          onDone={(correct) => {
            void fetch("/api/review", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ wordId: q.wordId, correct, practice }),
            });
            if (correct) setScore((s) => s + 1);
            setIndex((i) => i + 1);
          }}
        />
      </div>
    </div>
  );
}

function Header({ practice }: { practice?: boolean }) {
  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Review</h1>
      <p className="mt-1 text-sm text-muted">{practice ? "Practice round — no pressure" : "Spaced repetition"}</p>
    </div>
  );
}
