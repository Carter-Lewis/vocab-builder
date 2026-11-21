"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedInGate } from "./signed-in-gate";

const TABS = [
  { href: "/", label: "Today", icon: SunIcon },
  { href: "/bank", label: "Word bank", icon: BookIcon },
  { href: "/review", label: "Review", icon: CardsIcon },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="pt-safe flex items-center justify-between px-5 pb-2">
        <span className="font-serif text-lg tracking-tight text-ink-soft">wordwell</span>
        <div className="flex h-8 w-8 items-center justify-center">
          <UserButton />
        </div>
      </header>

      <main className="flex-1 px-5 pb-28">
        <SignedInGate>{children}</SignedInGate>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md">
        <ul className="mx-auto flex max-w-xl justify-around pt-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-medium transition-colors ${
                    active ? "text-clay" : "text-muted"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="6" y="3.5" width="13" height="16" rx="2" />
      <path d="M4 7v11.5A2.5 2.5 0 0 0 6.5 21H15" strokeLinecap="round" />
    </svg>
  );
}
