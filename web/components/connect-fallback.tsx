"use client";

import {useIsInMiniApp} from "@coinbase/onchainkit/minikit";
import {useAccount, useConnect} from "wagmi";
import {Button} from "@/components/ui/button";
import {friendlyError} from "@/lib/errors";

/**
 * A way in for anyone who opened PayFrens outside Base App.
 *
 * Inside Base App the wallet attaches on its own, so the app never needed a
 * connect affordance — which left a regular browser with no route forward at
 * all: the empty state says "open this in Base App" and nothing else is
 * actionable.
 *
 * Deliberately renders nothing until `useIsInMiniApp` resolves. It answers
 * asynchronously, and treating "not yet known" as "not in a mini app" would
 * flash a Connect button inside Base App in the moment before auto-connect
 * lands — the exact thing this must not disturb.
 */
export function ConnectFallback() {
  const {isInMiniApp} = useIsInMiniApp();
  const {isConnected} = useAccount();
  const {connect, connectors, isPending, error} = useConnect();

  // `undefined` means still detecting — stay quiet rather than guess.
  if (isInMiniApp !== false) return null;
  if (isConnected) return null;
  if (connectors.length === 0) return null;

  return (
    <div className="mt-1 flex w-full flex-col items-center gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          variant="secondary"
          size="md"
          loading={isPending}
          onClick={() => connect({connector})}
        >
          {connectors.length === 1 ? "Connect Wallet" : `Connect with ${connector.name}`}
        </Button>
      ))}

      {error && <p className="max-w-[26ch] text-xs text-danger">{friendlyError(error)}</p>}
    </div>
  );
}
