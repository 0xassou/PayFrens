export function EmptyState({
  title,
  description,
  visual,
  action,
}: {
  title: string;
  description: string;
  /** Replaces the default icon tile — for states that deserve their own art. */
  visual?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      {visual ?? <DefaultVisual />}
      <h2 className="text-base font-semibold text-content">{title}</h2>
      <p className="max-w-[26ch] text-sm text-content-muted">{description}</p>
      {action}
    </div>
  );
}

function DefaultVisual() {
  return (
    <div className="flex size-12 items-center justify-center rounded-pill bg-accent-subtle text-accent">
      <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
        <path
          d="M4 8.5h16M4 8.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5M4 8.5 6.2 4.8A1.5 1.5 0 0 1 7.5 4h9a1.5 1.5 0 0 1 1.3.8L20 8.5M12 12v4M10 14h4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * For empty states that are actually good news. "Nothing here" and "nothing
 * left to pay" are the same absence of content and should not look the same:
 * this one is mint, haloed and confetti-flecked rather than a grey placeholder.
 */
export function CelebrationVisual() {
  return (
    <div className="relative flex size-16 items-center justify-center" aria-hidden="true">
      {/* Two haloes reading outward, so the mark has somewhere to sit. */}
      <span className="absolute inset-0 rounded-pill bg-success-subtle" />
      <span className="absolute inset-2 rounded-pill bg-success-subtle" />

      <span className="relative flex size-9 items-center justify-center rounded-pill bg-success text-success-content">
        <svg viewBox="0 0 24 24" fill="none" className="size-5">
          <path
            d="m6.5 12.5 3.6 3.6 7.4-8.2"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Confetti. Three flecks is enough to read as celebration; more turns
          into noise at this size. */}
      <span className="absolute top-0 right-1 size-1.5 rounded-pill bg-success" />
      <span className="absolute bottom-1 left-0 size-1 rounded-pill bg-accent" />
      <span className="absolute top-2.5 left-1 size-1 rounded-pill bg-success-border" />
    </div>
  );
}
