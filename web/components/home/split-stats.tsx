import {cn} from "@/lib/cn";
import {formatUsdc} from "@/lib/format";

/**
 * A three-number read on where this wallet stands, sitting above the New Split
 * button.
 *
 * Deliberately renders at zero rather than hiding itself: "0 active · $0
 * settled" tells a new user what the app is going to keep track of, whereas an
 * empty gap tells them nothing and makes the first screen look unfinished.
 */
export function SplitStats({
  active,
  settled,
  volume,
}: {
  /** Splits still collecting money. */
  active: number;
  /** Splits that are finished — withdrawn or cancelled. */
  settled: number;
  /** Lifetime value of every split this wallet has been part of. */
  volume: bigint;
}) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Stat label="Active" value={String(active)} tone={active > 0 ? "accent" : "muted"} />
      <Stat label="Settled" value={String(settled)} tone={settled > 0 ? "success" : "muted"} />
      <Stat label="Volume" value={formatUsdc(volume)} tone={volume > 0n ? "content" : "muted"} />
    </dl>
  );
}

const TONES = {
  accent: "text-accent dark:text-accent-pressed",
  success: "text-success",
  content: "text-content",
  muted: "text-content-subtle",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <dd
        className={cn(
          "tabular truncate leading-tight font-bold",
          // A third of a phone's width is not much. Step the size down as the
          // number grows so a six-figure lifetime volume shrinks rather than
          // truncating — "$1,234,5…" is worse than no number at all.
          value.length > 10 ? "text-sm" : value.length > 7 ? "text-base" : "text-lg",
          TONES[tone],
        )}
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-[0.625rem] font-semibold tracking-wide text-content-subtle uppercase">
        {label}
      </dt>
    </div>
  );
}
