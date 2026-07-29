import {cn} from "@/lib/cn";

/**
 * States, in plain language, whether the creator can pull money out before
 * everyone has paid.
 *
 * Shown to every viewer, not just the creator. For a participant this is
 * material information — it decides whether the money they are about to send
 * sits in escrow until the bill is settled, or can leave straight away — and
 * the flag is fixed at creation, so nobody can change it after they have read
 * it here.
 */
export function WithdrawalPolicy({
  allowPartial,
  isCreator,
  className,
}: {
  allowPartial: boolean;
  isCreator: boolean;
  className?: string;
}) {
  // Written out per case rather than interpolating a subject: "you" and "the
  // creator" take different verb forms, and a shared template gets that wrong.
  const explanation = allowPartial
    ? isCreator
      ? "You can withdraw as people pay, even if not everyone has settled up yet."
      : "The creator can withdraw as people pay, even if not everyone has settled up yet."
    : isCreator
      ? "Nothing can be withdrawn until every share is paid — you close the split in one go."
      : "Nothing can be withdrawn until every share is paid — the creator closes the split in one go.";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-card border px-3.5 py-3",
        allowPartial
          ? "border-accent/30 bg-accent-subtle"
          : "border-border bg-surface-sunken",
        className,
      )}
    >
      <span className={cn("mt-px shrink-0", allowPartial ? "text-accent" : "text-content-subtle")}>
        {allowPartial ? <UnlockIcon /> : <LockIcon />}
      </span>

      <div className="min-w-0">
        <p
          className={cn(
            "text-xs font-semibold",
            allowPartial ? "text-accent" : "text-content",
          )}
        >
          {allowPartial ? "Partial withdrawal allowed" : "Withdrawal on full payment only"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{explanation}</p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <rect
        x="4.75"
        y="10.75"
        width="14.5"
        height="9.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8.25 10.5V7.75a3.75 3.75 0 0 1 7.5 0v2.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <rect
        x="4.75"
        y="10.75"
        width="14.5"
        height="9.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8.25 10.5V7.75a3.75 3.75 0 0 1 7.09-1.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
