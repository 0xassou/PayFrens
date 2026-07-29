import {cn} from "@/lib/cn";
import {percentOf} from "@/lib/format";

/**
 * How much of a split has been funded. Turns mint once it is complete, which is
 * the single most important state change in the app — it is the moment the
 * creator can withdraw.
 */
export function ProgressBar({
  paid,
  total,
  className,
  label,
}: {
  paid: bigint;
  total: bigint;
  className?: string;
  label?: string;
}) {
  const percent = percentOf(paid, total);
  const complete = total > 0n && paid >= total;

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-sunken", className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Split progress"}
    >
      <div
        className={cn(
          "h-full rounded-pill transition-all duration-500 ease-out-quint",
          complete ? "bg-success" : "bg-accent",
        )}
        // A width this dynamic has no sensible utility class.
        style={{width: `${Math.max(percent, percent > 0 ? 4 : 0)}%`}}
      />
    </div>
  );
}
