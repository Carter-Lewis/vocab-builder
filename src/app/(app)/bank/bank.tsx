"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category } from "@/db/schema";
import { CategoryPill, WordHeading } from "@/components/word-display";
import { statusOf, type Word } from "@/lib/types";
import { Sheet } from "@/components/sheet";
import { AddWord } from "./add-word";

type CategoryFilter = "all" | Category;
type StatusFilter = "all" | "new" | "learning" | "mastered";

const STATUS_STYLES: Record<Exclude<StatusFilter, "all">, string> = {
  new: "text-muted",
  learning: "text-clay",
  mastered: "text-sage",
};

export function Bank() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pos, setPos] = useState("all");
  const [open, setOpen] = useState<Word | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/words")
      .then((r) => r.json())
      .then(setWords);
  }, []);

  const partsOfSpeech = useMemo(
    () => [...new Set((words ?? []).map((w) => w.partOfSpeech).filter((p): p is string => !!p))].sort(),
    [words],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (words ?? []).filter(
      (w) =>
        (category === "all" || w.category === category) &&
        (status === "all" || statusOf(w) === status) &&
        (pos === "all" || w.partOfSpeech === pos) &&
        (!q ||
          w.word.toLowerCase().includes(q) ||
          w.definition.toLowerCase().includes(q) ||
          w.notes?.toLowerCase().includes(q)),
    );
  }, [words, query, category, status, pos]);

  function upsert(w: Word) {
    setWords((ws) => {
      const list = ws ?? [];
      return list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [w, ...list];
    });
  }

  return (
    <div className="pt-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Word bank</h1>
          <p className="mt-1 text-sm text-muted">
            {words ? `${words.length} ${words.length === 1 ? "word" : "words"}` : " "}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg active:scale-[0.98]"
        >
          + Add word
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search words, definitions, notes"
        className="mt-5 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-clay focus:outline-none"
      />

      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <Chips
          value={category}
          onChange={setCategory}
          options={[
            ["all", "All"],
            ["practical", "Practical"],
            ["humorous", "Humorous"],
          ]}
        />
        <span className="w-px shrink-0 bg-line" />
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            ["all", "Any status"],
            ["new", "New"],
            ["learning", "Learning"],
            ["mastered", "Mastered"],
          ]}
        />
        {partsOfSpeech.length > 1 && (
          <>
            <span className="w-px shrink-0 bg-line" />
            <select
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              aria-label="Part of speech"
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-sm! text-ink-soft"
            >
              <option value="all">Any type</option>
              {partsOfSpeech.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {words === null ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-12 text-center text-ink-soft">
          {words.length === 0 ? "Your bank is empty. Today's word will land here." : "No words match."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((w) => {
            const s = statusOf(w);
            return (
              <li key={w.id}>
                <button onClick={() => setOpen(w)} className="w-full px-4 py-3.5 text-left active:bg-surface-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-xl text-ink">{w.word}</span>
                    <span className={`shrink-0 text-xs font-medium capitalize ${STATUS_STYLES[s]}`}>{s}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{w.definition}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <WordSheet
          word={open}
          onClose={() => setOpen(null)}
          onChange={(w) => {
            upsert(w);
            setOpen(w);
          }}
          onDelete={(id) => {
            setWords((ws) => ws?.filter((w) => w.id !== id) ?? null);
            setOpen(null);
          }}
        />
      )}

      {adding && (
        <AddWord
          onClose={() => setAdding(false)}
          onAdded={(w) => {
            upsert(w);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return options.map(([v, label]) => (
    <button
      key={v}
      onClick={() => onChange(v)}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
        value === v ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft"
      }`}
    >
      {label}
    </button>
  ));
}

function WordSheet({
  word,
  onClose,
  onChange,
  onDelete,
}: {
  word: Word;
  onClose: () => void;
  onChange: (w: Word) => void;
  onDelete: (id: number) => void;
}) {
  const [notes, setNotes] = useState(word.notes ?? "");
  const [confirming, setConfirming] = useState(false);

  async function patch(body: Partial<Pick<Word, "notes" | "category">>) {
    const res = await fetch(`/api/words/${word.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onChange(await res.json());
  }

  async function remove() {
    await fetch(`/api/words/${word.id}`, { method: "DELETE" });
    onDelete(word.id);
  }

  const s = statusOf(word);
  const added = new Date(word.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <Sheet onClose={onClose} label={word.word}>
      <WordHeading w={word} size="md" />
      <p className="mt-5 text-lg leading-relaxed">{word.definition}</p>
      {word.example && (
        <p className="mt-3 border-l-2 border-clay-soft pl-4 font-serif leading-relaxed text-ink-soft italic">
          “{word.example}”
        </p>
      )}
      {word.why && <p className="mt-4 text-sm leading-relaxed text-ink-soft">{word.why}</p>}

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
        <Stat label="Status" value={s} />
        <Stat label="Correct" value={String(word.correctCount)} />
        <Stat label="Missed" value={String(word.incorrectCount)} />
      </dl>

      <label htmlFor="notes" className="mt-6 block text-xs font-semibold tracking-wide text-muted uppercase">
        Notes
      </label>
      <textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (word.notes ?? "") && patch({ notes: notes || null })}
        rows={3}
        placeholder="Your sentence, where you saw it, a memory trick…"
        className="mt-2 w-full resize-none rounded-2xl border border-line bg-surface p-3.5 leading-relaxed placeholder:text-muted focus:border-clay focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => patch({ category: word.category === "humorous" ? "practical" : "humorous" })}
          className="flex items-center gap-2 text-sm text-ink-soft"
        >
          <CategoryPill category={word.category} />
          <span className="underline decoration-line underline-offset-4">switch</span>
        </button>
        {confirming ? (
          <span className="flex gap-3 text-sm">
            <button onClick={() => setConfirming(false)} className="text-ink-soft">
              Keep
            </button>
            <button onClick={remove} className="font-medium text-danger">
              Delete
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-sm text-muted">
            Remove
          </button>
        )}
      </div>
      <p className="mt-6 mb-2 text-center text-xs text-muted">
        Added {added} · {word.source === "daily" ? "Word of the day" : "Added by you"}
      </p>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <dt className="text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize text-ink">{value}</dd>
    </div>
  );
}
