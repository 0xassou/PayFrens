"use client";

import {useEffect} from "react";
import type {Connector} from "wagmi";
import {useConnect} from "wagmi";
import {Modal} from "@/components/ui/modal";
import {Spinner} from "@/components/ui/spinner";
import {cn} from "@/lib/cn";
import {friendlyError} from "@/lib/errors";

/**
 * The wallet picker.
 *
 * OnchainKit ships one of these — `<ConnectWallet>` opens `WalletModal` when
 * `OnchainKitProvider` is given `config.wallet.display: "modal"`. Three things
 * ruled it out here:
 *
 *  1. It is styled entirely in OnchainKit's own `ock-*` classes, which live in
 *     `@coinbase/onchainkit/styles.css`. This app never imports that sheet — it
 *     defines its own tokens in globals.css — so the modal would render
 *     unstyled, and importing it would drop a second Tailwind theme on top of
 *     ours.
 *  2. Its wallet list is hardcoded (Coinbase, MetaMask, Phantom, plus opt-in
 *     Rabby/Trust/Frame) and it builds *fresh* connector instances per row
 *     rather than using the ones wagmi already has. So it offers wallets that
 *     are not installed and hides ones that are.
 *  3. It is a fixed `22rem` centred card — not a bottom sheet on a phone.
 *
 * Reading `useConnect().connectors` instead gives the real list: the connector
 * OnchainKit configured (Base Account) first, then one per EIP-6963 wallet the
 * browser announced, each carrying its own name and icon.
 */
export function WalletModal({open, onClose}: {open: boolean; onClose: () => void}) {
  const {connect, connectors, isPending, variables, error, reset} = useConnect();

  // A failed attempt should not still be on screen the next time this opens.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // wagmi hands back the exact object we passed, so `uid` identifies the row
  // that is mid-connect rather than spinning all of them at once.
  const pendingUid = isPending ? (variables?.connector as Connector | undefined)?.uid : undefined;

  return (
    <Modal open={open} onClose={onClose} title="Connect a wallet">
      {connectors.length === 0 ? (
        <p className="pb-4 text-sm text-content-muted">
          No wallets detected. Install a browser wallet, or open PayFrens inside Base App.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {connectors.map((connector) => (
            <li key={connector.uid}>
              <WalletRow
                connector={connector}
                pending={pendingUid === connector.uid}
                // Any attempt disables the rest: two wallet popups racing each
                // other is how you end up connected to the one you did not tap.
                disabled={isPending && pendingUid !== connector.uid}
                onSelect={() => connect({connector}, {onSuccess: onClose})}
              />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-center text-xs text-danger">
          {friendlyError(error)}
        </p>
      )}

      <p className="mt-4 mb-1 text-center text-xs text-content-subtle">
        PayFrens never moves funds without a signature from you.
      </p>
    </Modal>
  );
}

function WalletRow({
  connector,
  pending,
  disabled,
  onSelect,
}: {
  connector: Connector;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || pending}
      className={cn(
        "flex w-full items-center gap-3 rounded-card px-3 py-3 text-left",
        "border border-border bg-surface transition-colors duration-200",
        "hover:bg-surface-hover active:bg-surface-hover",
        "disabled:pointer-events-none disabled:opacity-45",
      )}
    >
      <ConnectorIcon connector={connector} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-content">
          {connector.name}
        </span>
        <span className="block text-xs text-content-subtle">{captionFor(connector)}</span>
      </span>

      {pending ? (
        <Spinner className="size-4 shrink-0 text-content-subtle" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4 shrink-0 text-content-subtle"
          aria-hidden="true"
        >
          <path
            d="M9.5 5.5 16 12l-6.5 6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * Base Account is a passkey, not an extension, so "detected" would be a lie —
 * it is always available. Everything else in the list got there because the
 * wallet itself announced over EIP-6963, which means it really is installed.
 */
function captionFor(connector: Connector): string {
  if (connector.id === "baseAccount") return "Passkey · no extension needed";
  if (connector.type === "farcasterMiniApp" || connector.type === "farcasterFrame") {
    return "Your Base App wallet";
  }
  return "Detected in this browser";
}

function ConnectorIcon({connector}: {connector: Connector}) {
  if (connector.icon) {
    return (
      // Wallet icons arrive as data URIs over EIP-6963. next/image cannot help
      // with those and would only add a loader to a string already in memory.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={connector.icon}
        alt=""
        aria-hidden="true"
        className="size-9 shrink-0 rounded-[0.625rem] object-cover"
      />
    );
  }

  if (connector.id === "baseAccount") {
    return (
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-accent"
      >
        <span className="size-4 rounded-pill bg-accent-content" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-sunken text-sm font-bold text-content-muted"
    >
      {connector.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1)?.toUpperCase() || "?"}
    </span>
  );
}
