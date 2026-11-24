"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WordHeading } from "@/components/word-display";
import { localDate, type Word } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; word: Word | null; dueCount: number }
  | { kind: "error"; message: string };

const POLL_MS = 2500;
const MAX_POLLS = 12;

export function Today() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [dateLabel, setDateLabel] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const today = new Date();
    setDateLabel(today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));

    const profile = await fetch("/api/profile").then((r) => r.json());
    if (!profile.placementDone) {
      router.replace("/welcome");
      return;
    }

    for (let i = 0; i < MAX_POLLS; i++) {
      const res = await fetch(`/api/daily?date=${localDate(today)}`);
      const data = await res.json();
      if (res.status === 202) {
        // Another request is already picking today's word.
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setState({ kind: "ready", word: data.word, dueCount: data.dueCount });
      return;
    }
    setState({ kind: "error", message: "This is taking longer than usual." });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kick off the initial fetch
    void load();
  }, [load]);

  async function resolve(wordId: number, action: "known" | "skip") {
    setState({ kind: "loading" });
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: localDate(), wordId, action }),
      });
      if (res.status === 409 || res.status === 400) {
        // Already resolved elsewhere, or the day rolled over — show the current word.
        await load();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setState({ kind: "ready", word: data.word, dueCount: data.dueCount });
    } catch {
      setState({ kind: "error", message: "Something went wrong." });
    }
  }

  return (
    <div className="pt-6">
      <p className="h-5 text-sm text-muted">{dateLabel}</p>
      <p className="mt-0.5 text-sm font-medium tracking-wide text-clay uppercase">Word of the day</p>

      {state.kind === "loading" && <Loading />}

      {state.kind === "error" && (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-ink-soft">{state.message}</p>
          <button onClick={load} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg active:scale-[0.98]">
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && !state.word && (
        <p className="mt-10 text-ink-soft">That&apos;s all for today. A new word arrives tomorrow.</p>
      )}

      {state.kind === "ready" && state.word && (
        <WordOfDay key={state.word.id} word={state.word} dueCount={state.dueCount} onResolve={resolve} />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 animate-pulse space-y-4" aria-label="Finding today's word">
      <div className="h-12 w-2/3 rounded-xl bg-surface-2" />
      <div className="h-4 w-1/3 rounded bg-surface-2" />
      <div className="mt-8 h-28 rounded-2xl bg-surface-2" />
      <p className="pt-2 text-sm text-muted">Finding a word worth knowing…</p>
    </div>
  );
}

function WordOfDay({
  word,
  dueCount,
  onResolve,
}: {
  word: Word;
  dueCount: number;
  onResolve: (wordId: number, action: "known" | "skip") => void;
}) {
  return (
    <article className="rise mt-6">
      <WordHeading w={word} />

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <p className="text-lg leading-relaxed text-ink">{word.definition}</p>
        {word.example && (
          <p className="mt-4 border-l-2 border-clay-soft pl-4 font-serif text-[17px] leading-relaxed text-ink-soft italic">
            “{word.example}”
          </p>
        )}
      </section>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onResolve(word.id, "known")}
          className="flex-1 rounded-full bg-sage-soft px-4 py-2.5 text-sm font-medium text-sage active:scale-[0.98]"
        >
          I know this already
        </button>
        <button
          onClick={() => onResolve(word.id, "skip")}
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft active:scale-[0.98]"
        >
          Skip this word
        </button>
      </div>

      {word.why && (
        <section className="mt-5 px-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Why this word</h2>
          <p className="mt-1.5 leading-relaxed text-ink-soft">{word.why}</p>
        </section>
      )}

      {word.dictionaryDefinition && word.dictionaryDefinition !== word.definition && (
        <section className="mt-5 px-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Dictionary</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{word.dictionaryDefinition}</p>
        </section>
      )}

      <YourSentence word={word} />

      {dueCount > 0 && (
        <Link
          href="/review"
          className="mt-6 flex items-center justify-between rounded-2xl bg-sage-soft px-5 py-4 text-sage active:scale-[0.99]"
        >
          <span className="font-medium">
            {dueCount} {dueCount === 1 ? "word" : "words"} ready to review
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </article>
  );
}

/** Writing your own sentence is the best way to make a word stick. Saved as a note. */
function YourSentence({ word }: { word: Word }) {
  const [text, setText] = useState(word.notes ?? "");
  const [saved, setSaved] = useState(!!word.notes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/words/${word.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: text || null }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <section className="mt-6">
      <label htmlFor="sentence" className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
        Use it in a sentence
      </label>
      <textarea
        id="sentence"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder={`Try writing your own sentence with “${word.word}”…`}
        className="mt-2 w-full resize-none rounded-2xl border border-line bg-surface p-4 leading-relaxed text-ink placeholder:text-muted focus:border-clay focus:outline-none"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={save}
          disabled={saving || saved || !text.trim()}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg transition-opacity disabled:opacity-40"
        >
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
