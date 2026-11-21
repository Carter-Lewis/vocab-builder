import { Suspense } from "react";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 pb-10">
      <p className="font-serif text-2xl tracking-tight text-ink">wordwell</p>
      <p className="mt-1 mb-8 text-sm text-muted">A daily word, chosen for you.</p>
      {/* Clerk's forms read the URL at runtime. */}
      <Suspense fallback={<div className="h-96 w-full max-w-sm animate-pulse rounded-2xl bg-surface-2" />}>
        {children}
      </Suspense>
    </main>
  );
}
