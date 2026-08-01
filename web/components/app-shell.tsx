"use client";

import Link from "next/link";
import {ThemeToggle} from "@/components/theme/theme-toggle";
import {NetworkBanner} from "@/components/wallet/network-banner";
import {cn} from "@/lib/cn";

/**
 * Every screen is a single column capped at a phone's width, because that is
 * the only viewport Base App ever renders this in. On desktop it centres rather
 * than stretching into an unusable full-width layout.
 */
export function AppShell({
  children,
  title,
  back,
  action,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  /** Href for the back chevron. Omitted on the root screen. */
  back?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 bg-app/85 px-4 pt-safe pb-3 backdrop-blur-lg">
        <div className="flex h-10 items-center gap-2">
          {back ? (
            <Link
              href={back}
              aria-label="Back"
              className="-ml-2 flex size-9 items-center justify-center rounded-pill text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                <path
                  d="M14.5 5.5 8 12l6.5 6.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2" aria-label="PayFrens home">
              <Logo />
            </Link>
          )}

          {title && <h1 className="truncate text-base font-semibold text-content">{title}</h1>}

          <div className="ml-auto flex items-center gap-2">{action ?? <ThemeToggle />}</div>
        </div>
      </header>

      <main className={cn("flex-1 px-4 pb-safe", className)}>
        <NetworkBanner />
        {children}
      </main>
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex size-7 items-center justify-center rounded-[0.5rem] bg-accent text-[0.8125rem] font-black text-accent-content">
        P
      </span>
      <span className="text-base font-bold tracking-tight text-content">PayFrens</span>
    </span>
  );
}
