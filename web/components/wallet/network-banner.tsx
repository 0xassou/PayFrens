"use client";

import {useAccount, useSwitchChain} from "wagmi";
import {Button} from "@/components/ui/button";
import {ACTIVE_CHAIN, ACTIVE_CHAIN_ID} from "@/lib/chains";
import {friendlyError} from "@/lib/errors";

/**
 * Wagmi's `chainId` tracks the connector's own `chainChanged` event, so this
 * clears itself the instant a switch lands — through the button below or done
 * by hand in the wallet — with no refresh or reconnect needed.
 *
 * The switch is button-triggered rather than fired automatically on mount.
 * Prompting a wallet popup before the user has done anything reads as
 * unsolicited and some wallets throttle or ignore chain requests that were
 * not preceded by a click, so a visible cause-and-effect action is both
 * friendlier and more reliable than an auto-prompt.
 */
export function NetworkBanner() {
  const {isConnected, chainId} = useAccount();
  const {switchChain, isPending, error} = useSwitchChain();

  if (!isConnected || chainId === ACTIVE_CHAIN_ID) return null;

  return (
    <div role="alert" className="mb-4 rounded-card bg-danger-subtle px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-danger">Wrong network — switch your wallet to {ACTIVE_CHAIN.name}.</p>
        <Button
          size="sm"
          variant="danger"
          loading={isPending}
          onClick={() => switchChain({chainId: ACTIVE_CHAIN_ID})}
          className="shrink-0"
        >
          {isPending ? "Switching…" : "Switch"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{friendlyError(error)}</p>}
    </div>
  );
}
