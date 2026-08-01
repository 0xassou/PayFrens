"use client";

import {useState} from "react";
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
 *
 * Adding the chain first is not our job to orchestrate: both `injected` and
 * `baseAccount` (the two connectors this app offers, see wallet-modal.tsx)
 * already catch the "unrecognised chain" error (code 4902) inside their own
 * `switchChain` and retry through `wallet_addEthereumChain` before giving up
 * — see @wagmi/connectors' source for both. What they do not protect against
 * is a request that never settles at all: if a wallet's confirmation popup
 * gets blocked by the browser, `switchChainAsync` just hangs, forever, with
 * no error and no popup — which reads to the user as a dead button. The
 * timeout below is what turns that into a message they can act on.
 */
const SWITCH_TIMEOUT_MS = 20_000;

class SwitchChainTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for the wallet to respond.");
    this.name = "SwitchChainTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SwitchChainTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function switchErrorMessage(error: Error): string {
  if (error instanceof SwitchChainTimeoutError) {
    return "Your wallet didn't respond — check for a blocked pop-up, then try again.";
  }

  // friendlyError's chain-mismatch branch is written for a failed transaction
  // ("switch to Base Sepolia"), which just parrots back the banner this error
  // already sits under. Whatever went wrong here needs a next step instead.
  const message = friendlyError(error, "Couldn't switch networks. Try switching manually in your wallet.");
  return message.startsWith("Wrong network")
    ? "Couldn't switch networks automatically. Try switching manually in your wallet."
    : message;
}

export function NetworkBanner() {
  const {isConnected, chainId} = useAccount();
  const {switchChainAsync} = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  // Tagged with the chain it failed *from*, so a failure here does not
  // resurface if the wallet drifts onto the wrong chain again later.
  const [failedAttempt, setFailedAttempt] = useState<{fromChainId?: number; error: Error} | null>(null);

  if (!isConnected || chainId === ACTIVE_CHAIN_ID) return null;

  const error = failedAttempt && failedAttempt.fromChainId === chainId ? failedAttempt.error : null;

  const handleSwitch = async () => {
    setFailedAttempt(null);
    setIsSwitching(true);
    try {
      await withTimeout(switchChainAsync({chainId: ACTIVE_CHAIN_ID}), SWITCH_TIMEOUT_MS);
    } catch (cause) {
      setFailedAttempt({fromChainId: chainId, error: cause as Error});
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div role="alert" className="mb-4 rounded-card bg-danger-subtle px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-danger">Wrong network — switch your wallet to {ACTIVE_CHAIN.name}.</p>
        <Button
          size="sm"
          variant="danger"
          loading={isSwitching}
          onClick={() => void handleSwitch()}
          className="shrink-0"
        >
          {isSwitching ? "Switching…" : "Switch"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{switchErrorMessage(error)}</p>}
    </div>
  );
}
