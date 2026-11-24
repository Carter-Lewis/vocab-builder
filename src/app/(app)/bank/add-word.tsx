"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { Sheet } from "@/components/sheet";

type Meaning = { partOfSpeech: string; definition: string; example?: string };
type Entry = { word: string; phonetic?: string; audioUrl?: string; meanings: Meaning[] };

export function AddWord({ onClose, onAdded }: { onClose: () => void; onAdded: (w: Word) => void }) {
  const [word, setWord] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [definition, setDefinition] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [example, setExample] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function lookup() {
    if (!word.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/lookup?word=${encodeURIComponent(word.trim())}`);
    setBusy(false);
    if (!res.ok) {
      setEntry(null);
      setMessage(
        res.status === 503
          ? "The dictionary is unreachable right now. You can write your own definition below."
          : "Not in the dictionary. You can still write your own definition below.",
      );
      return;
    }
    const e: Entry = await res.json();
    setEntry(e);
    choose(e, 0);
  }

  function choose(e: Entry, i: number) {
    const m = e.meanings[i];
    setPicked(i);
    setDefinition(m.definition);
    setPartOfSpeech(m.partOfSpeech);
    setExample(m.example ?? "");
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/words", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        word: entry?.word ?? word.trim(),
        definition,
        partOfSpeech: partOfSpeech || undefined,
        phonetic: entry?.phonetic || undefined,
        audioUrl: entry?.audioUrl || undefined,
        example: example || undefined,
        notes: notes || undefined,
      }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) return setMessage(data.error);
    onAdded(data);
  }

  const field =
    "w-full rounded-2xl border border-line bg-surface px-4 py-3 leading-relaxed placeholder:text-muted focus:border-clay focus:outline-none";

  return (
    <Sheet onClose={onClose} label="Add a word">
      <h2 className="font-serif text-2xl">Add a word</h2>
      <p className="mt-1 text-sm text-muted">Found one in the wild? Keep it.</p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="e.g. sonder"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          className={field}
        />
        <button
          type="submit"
          disabled={busy || !word.trim()}
          className="shrink-0 rounded-2xl bg-surface-2 px-4 font-medium text-ink disabled:opacity-40"
        >
          Look up
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-ink-soft">{message}</p>}

      {entry && entry.meanings.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Which meaning?</p>
          <ul className="mt-2 space-y-2">
            {entry.meanings.slice(0, 6).map((m, i) => (
              <li key={i}>
                <button
                  onClick={() => choose(entry, i)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-sm leading-snug ${
                    picked === i ? "border-clay bg-clay-soft/50" : "border-line bg-surface"
                  }`}
                >
                  <span className="mr-1.5 text-muted italic">{m.partOfSpeech}</span>
                  {m.definition}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(entry || message) && (
        <div className="mt-5 space-y-3">
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={2}
            placeholder="Definition"
            className={field + " resize-none"}
          />
          <input value={example} onChange={(e) => setExample(e.target.value)} placeholder="Example (optional)" className={field} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className={field + " resize-none"}
          />
          <button
            onClick={save}
            disabled={busy || !definition.trim()}
            className="mt-2 mb-3 w-full rounded-full bg-clay py-3.5 font-medium text-white disabled:opacity-40"
          >
            Save to bank
          </button>
        </div>
      )}
    </Sheet>
  );
}
