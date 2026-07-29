"use client";

import {Button} from "@/components/ui/button";
import {Sheet} from "@/components/ui/sheet";
import {formatUsdc} from "@/lib/format";

/**
 * The fee disclosure. The creator sees the gross, the fee and the net before
 * the wallet ever opens — the numbers come from the contract's own
 * `quoteWithdrawal`, not from re-deriving 0.5% in JavaScript, so what is shown
 * is exactly what will be transferred.
 */
export function WithdrawSheet({
  open,
  onClose,
  gross,
  net,
  fee,
  onConfirm,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  gross: bigint;
  net?: bigint;
  fee?: bigint;
  onConfirm: () => void;
  isPending: boolean;
  error?: string | null;
}) {
  const loaded = net !== undefined && fee !== undefined;

  return (
    <Sheet open={open} onClose={onClose} title="Withdraw">
      <div className="mb-5 space-y-2.5">
        <Row label="Collected" value={formatUsdc(gross)} />
        <Row
          label="Protocol fee (0.5%)"
          value={loaded ? `−${formatUsdc(fee)}` : "…"}
          muted
        />
        <div className="border-t border-border pt-2.5">
          <Row label="You receive" value={loaded ? formatUsdc(net) : "…"} emphasis />
        </div>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-content-subtle">
        The 0.5% fee is charged once, here, on money you collect. Nobody who paid their share was
        charged anything.
      </p>

      {error && (
        <p className="mb-3 rounded-card bg-danger-subtle px-3.5 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="mb-2 flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button size="lg" onClick={onConfirm} loading={isPending} disabled={!loaded} className="flex-[2]">
          Withdraw {loaded ? formatUsdc(net) : ""}
        </Button>
      </div>
    </Sheet>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={emphasis ? "text-sm font-medium text-content" : "text-sm text-content-muted"}>
        {label}
      </span>
      <span
        className={
          emphasis
            ? "tabular text-xl font-bold text-content"
            : muted
              ? "tabular text-sm text-content-muted"
              : "tabular text-sm font-medium text-content"
        }
      >
        {value}
      </span>
    </div>
  );
}
