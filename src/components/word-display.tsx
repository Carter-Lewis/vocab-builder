"use client";

import { useRef } from "react";

export function AudioButton({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  return (
    <button
      type="button"
      aria-label="Play pronunciation"
      onClick={() => {
        audio.current ??= new Audio(src);
        audio.current.currentTime = 0;
        void audio.current.play();
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink-soft active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}

type Displayable = {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  partOfSpeech: string | null;
};

export function WordHeading({ w, size = "lg" }: { w: Displayable; size?: "lg" | "md" }) {
  return (
    <div>
      <h1 className={`font-serif tracking-tight text-ink ${size === "lg" ? "text-5xl" : "text-3xl"}`}>{w.word}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-ink-soft">
        {w.phonetic && <span className="font-serif italic">{w.phonetic}</span>}
        {w.audioUrl && <AudioButton src={w.audioUrl} />}
        {w.partOfSpeech && <span className="italic text-muted">{w.partOfSpeech}</span>}
      </div>
    </div>
  );
}
