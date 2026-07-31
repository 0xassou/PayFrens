"use client";

import {AvatarStack} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {ProgressBar} from "@/components/ui/progress-bar";
import {ConnectWallet} from "@/components/wallet/connect-wallet";
import {formatUsdc} from "@/lib/format";

/**
 * Everything someone sees before a wallet is attached.
 *
 * The job here is to answer "what is this and why would I connect?" without
 * demanding the connection first — hence the sample split further down, which
 * shows the actual product surface rather than describing it.
 */
export function Landing() {
  return (
    <div className="pb-10">
      <Hero />
      <Steps />
      <Preview />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate pt-6 pb-9 text-center">
      {/* Soft brand wash behind the headline. Purely atmospheric — it sits
          under everything and never intercepts a tap. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-pill bg-accent/15 blur-3xl"
      />

      <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold text-content-muted">
        <span className="size-1.5 rounded-pill bg-success" />
        Settles in USDC on Base
      </span>

      <h1 className="mt-4 text-[2.125rem] leading-[1.05] font-bold tracking-[-0.035em] text-balance text-content">
        Split any bill.{" "}
        <span className="text-accent dark:text-accent-pressed">Get paid back</span> in seconds.
      </h1>

      <p className="mx-auto mt-3.5 max-w-[30ch] text-[0.9375rem] leading-relaxed text-balance text-content-muted">
        Share one link, everyone pays their share, the money lands in your wallet. No IOUs, no
        spreadsheet, no chasing.
      </p>

      <div className="mt-7">
        <ConnectWallet />
        <p className="mt-2.5 text-xs text-content-subtle">
          Base Account, MetaMask, Rabby — or whatever your browser already has.
        </p>
      </div>
    </section>
  );
}

/**
 * Titles stay to a single word so all three wrap identically — at three columns
 * on a 390pt phone there is room for one, and a two-line title in the middle
 * card knocks the captions out of line with each other. The captions carry the
 * detail instead.
 */
const STEPS = [
  {
    title: "Create",
    caption: "Add your frens and who owes what.",
    icon: <ReceiptIcon />,
  },
  {
    title: "Collect",
    caption: "They each pay once, in USDC.",
    icon: <PeopleIcon />,
  },
  {
    title: "Withdraw",
    caption: "Cash out the moment it's funded.",
    icon: <WithdrawIcon />,
  },
];

function Steps() {
  return (
    <section aria-labelledby="how-it-works">
      <h2
        id="how-it-works"
        className="mb-2.5 text-xs font-semibold tracking-wide text-content-subtle uppercase"
      >
        How it works
      </h2>

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-card border border-border bg-surface p-3 text-center shadow-card"
          >
            <span className="relative mx-auto flex size-9 items-center justify-center rounded-[0.625rem] bg-accent-subtle text-accent">
              {step.icon}
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-pill bg-accent text-[0.5625rem] font-bold text-accent-content">
                {index + 1}
              </span>
            </span>

            <h3 className="mt-2.5 text-xs font-semibold text-balance text-content">{step.title}</h3>
            <p className="mt-1 text-[0.6875rem] leading-snug text-balance text-content-subtle">
              {step.caption}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Preview() {
  return (
    <section aria-labelledby="preview" className="mt-7">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2
          id="preview"
          className="text-xs font-semibold tracking-wide text-content-subtle uppercase"
        >
          A split, mid-flight
        </h2>
        <Badge tone="neutral">Sample</Badge>
      </div>

      {/*
       * Inert on purpose: this is a picture of the product, not the product.
       * `aria-hidden` keeps invented names and amounts out of a screen reader,
       * where "Sushi with the crew, $84" would read as the viewer's own data.
       */}
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none space-y-2.5 select-none">
          <SampleCard
            title="Sushi with the crew"
            meta="2h ago · 4 people"
            total={84_000_000n}
            paid={63_000_000n}
            people={[
              {name: "Ava", paid: true},
              {name: "Ben", paid: true},
              {name: "Chi", paid: true},
              {name: "Dee", paid: false},
            ]}
            badge={<Badge tone="neutral">3/4 paid</Badge>}
          />

          <SampleCard
            title="Taxi home"
            meta="Yesterday · 3 people"
            total={31_500_000n}
            paid={31_500_000n}
            people={[
              {name: "Ava", paid: true},
              {name: "Kit", paid: true},
              {name: "Rae", paid: true},
            ]}
            badge={<Badge tone="success">Fully paid</Badge>}
          />
        </div>

        {/* Fades the second card out rather than cutting it off, so the stack
            reads as "and more below" instead of a clipped bug. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-app"
        />
      </div>
    </section>
  );
}

/** A visual twin of `SplitCard` with the navigation taken out. */
function SampleCard({
  title,
  meta,
  total,
  paid,
  people,
  badge,
}: {
  title: string;
  meta: string;
  total: bigint;
  paid: bigint;
  people: Array<{name: string; paid: boolean}>;
  badge: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] font-semibold text-content">{title}</h3>
          <p className="mt-0.5 text-xs text-content-subtle">{meta}</p>
        </div>
        <span className="tabular shrink-0 text-[0.9375rem] font-semibold text-content">
          {formatUsdc(total)}
        </span>
      </div>

      <ProgressBar paid={paid} total={total} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <AvatarStack people={people} size="sm" max={5} />
        {badge}
      </div>
    </div>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[1.125rem]" aria-hidden="true">
      <path
        d="M6 3.5h12v17l-2.4-1.6L13.2 20.5 12 19.3l-1.2 1.2-2.4-1.4L6 20.5v-17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.25 8.5h5.5M9.25 12h5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[1.125rem]" aria-hidden="true">
      <circle cx="9.5" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.75 19a5.75 5.75 0 0 1 11.5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.5 5.2a3.25 3.25 0 0 1 0 5.6M18 19a5.75 5.75 0 0 0-2.2-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WithdrawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[1.125rem]" aria-hidden="true">
      <path
        d="M12 3.75v10.5m0 0 3.75-3.75M12 14.25 8.25 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.25 16.5v1.75a2 2 0 0 0 2 2h11.5a2 2 0 0 0 2-2V16.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
