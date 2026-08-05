"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useAccount} from "wagmi";
import {useComposeCast, useIsInMiniApp} from "@coinbase/onchainkit/minikit";
import {AppShell} from "@/components/app-shell";
import {ParticipantList} from "@/components/split/participant-list";
import {WithdrawSheet} from "@/components/split/withdraw-sheet";
import {WithdrawalPolicy} from "@/components/split/withdrawal-policy";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {ProgressBar} from "@/components/ui/progress-bar";
import {Spinner} from "@/components/ui/spinner";
import {splitUrl} from "@/lib/env";
import {friendlyError, reportError} from "@/lib/errors";
import {formatUsdc, relativeTime} from "@/lib/format";
import {useMiniAppReady} from "@/lib/hooks/use-mini-app";
import {useProfiles} from "@/lib/hooks/use-profiles";
import {usePayShare} from "@/lib/hooks/use-pay-share";
import {useCancelSplit, useWithdraw} from "@/lib/hooks/use-split-actions";
import {useSplit, useWithdrawalQuote} from "@/lib/hooks/use-splits";
import {
  isCreator,
  isEditable,
  isFullyPaid,
  outstanding,
  shareOf,
  SplitStatus,
  viewerRole,
  withdrawable,
} from "@/lib/splits";

export function SplitScreen({id}: {id: string}) {
  useMiniAppReady();

  const splitId = safeId(id);
  const {address} = useAccount();
  const {split, isLoading, refetch} = useSplit(splitId);
  const {data: profiles} = useProfiles(split?.participants);

  const [withdrawRequested, setWithdrawRequested] = useState(false);

  const share = split ? shareOf(split, address) : null;
  const pay = usePayShare(splitId, share ?? undefined);
  const {net, fee} = useWithdrawalQuote(splitId);
  const withdrawal = useWithdraw(splitId);
  const cancellation = useCancelSplit(splitId);

  // Any successful write invalidates what is on screen, so pull fresh state
  // rather than leaving a stale "you owe" under a completed transaction.
  useEffect(() => {
    if (pay.isSuccess || withdrawal.isSuccess || cancellation.isSuccess) {
      void refetch();
    }
  }, [pay.isSuccess, withdrawal.isSuccess, cancellation.isSuccess, refetch]);

  // Derived rather than closed by an effect: a successful withdrawal dismisses
  // the sheet on the next render, with no extra state round-trip.
  const showWithdraw = withdrawRequested && !withdrawal.isSuccess;

  if (isLoading) {
    return (
      <AppShell back="/">
        <div className="flex justify-center py-24 text-content-subtle">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (!split) {
    return (
      <AppShell back="/" title="Split not found">
        <p className="py-12 text-center text-sm text-content-muted">
          This split doesn&apos;t exist on {process.env.NEXT_PUBLIC_CHAIN_ID === "8453" ? "Base" : "Base Sepolia"}.
        </p>
      </AppShell>
    );
  }

  const role = viewerRole(split, address);
  const complete = isFullyPaid(split);
  const cancelled = split.status === SplitStatus.Cancelled;
  const available = withdrawable(split);
  const creator = isCreator(split, address);
  const editable = isEditable(split, address);

  return (
    <AppShell back="/" action={<ShareButton splitId={id} title={split.title} />}>
      <div className="pb-40">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            {cancelled ? (
              <Badge tone="danger">Cancelled</Badge>
            ) : complete ? (
              <Badge tone="success">Fully paid</Badge>
            ) : (
              <Badge tone="accent">
                {split.paidCount}/{split.participantCount} paid
              </Badge>
            )}
            <span className="text-xs text-content-subtle">{relativeTime(split.createdAt)}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-content">
            {split.title || `Split #${split.id}`}
          </h1>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="tabular text-4xl font-black text-content">
              {formatUsdc(split.totalAmount)}
            </span>
            <span className="text-sm font-medium text-content-subtle">USDC</span>
          </div>

          <ProgressBar
            paid={split.amountPaid}
            total={split.totalAmount}
            className="mt-4"
            label={`${split.paidCount} of ${split.participantCount} paid`}
          />

          <p className="mt-2 text-xs text-content-muted">
            {cancelled
              ? "Cancelled before anyone paid."
              : complete
                ? "Everyone has paid."
                : `${formatUsdc(outstanding(split))} still outstanding.`}
          </p>
        </div>

        {/* Moot once cancelled — nobody has paid in, so nothing to withdraw. */}
        {!cancelled && (
          <WithdrawalPolicy
            allowPartial={split.allowPartialWithdraw}
            isCreator={creator}
            className="mb-6"
          />
        )}

        <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-content-subtle uppercase">
          Who&apos;s in
        </h2>
        <ParticipantList split={split} profiles={profiles} viewer={address} />

        {/* Editing and cancelling share one window — creator, still open,
            nothing paid in — which is what `isEditable` is. Deliberately keyed
            off that and not the viewer role: a creator who is also a
            participant in their own split reads as "participant-owes" (they are
            asked to pay before being told to wait), which hid this row on the
            most common split of all. */}
        {editable && (
          <div className="mt-4">
            {cancellation.error && (
              <p className="mb-2 text-center text-xs text-danger">{friendlyError(cancellation.error)}</p>
            )}
            <div className="flex items-center justify-center gap-4">
              <Link
                href={`/create?edit=${split.id}`}
                className="py-2 text-xs font-medium text-content-subtle transition-colors hover:text-content"
              >
                Edit this split
              </Link>
              <span className="text-xs text-content-subtle/40" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => void cancellation.cancel()}
                disabled={cancellation.isPending}
                className="py-2 text-xs font-medium text-content-subtle transition-colors hover:text-danger disabled:opacity-50"
              >
                {cancellation.isPending ? "Cancelling…" : "Cancel this split"}
              </button>
            </div>
          </div>
        )}

        {(complete || cancelled) && (
          <Link href={`/create?from=${split.id}`} className="mt-4 block">
            <Button variant="secondary" size="md" fullWidth>
              <RepeatIcon />
              Split again with the same group
            </Button>
          </Link>
        )}
      </div>

      {/* The primary action lives in a fixed footer: whatever this viewer needs
          to do is always under their thumb, without scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border bg-app/90 px-4 pt-3 pb-safe backdrop-blur-lg">
        <Action
          role={role}
          share={share}
          available={available}
          allowPartial={split.allowPartialWithdraw}
          pay={pay}
          cancelled={cancelled}
          onWithdraw={() => setWithdrawRequested(true)}
        />
      </div>

      <WithdrawSheet
        open={showWithdraw}
        onClose={() => setWithdrawRequested(false)}
        gross={available}
        net={net}
        fee={fee}
        onConfirm={() => void withdrawal.withdraw()}
        isPending={withdrawal.isPending}
        error={withdrawal.error ? friendlyError(withdrawal.error) : null}
      />
    </AppShell>
  );
}

function Action({
  role,
  share,
  available,
  allowPartial,
  pay,
  cancelled,
  onWithdraw,
}: {
  role: ReturnType<typeof viewerRole>;
  share: bigint | null;
  available: bigint;
  allowPartial: boolean;
  pay: ReturnType<typeof usePayShare>;
  cancelled: boolean;
  onWithdraw: () => void;
}) {
  switch (role) {
    case "participant-owes":
      return (
        <div>
          {pay.error && (
            <p className="mb-2 text-center text-xs text-danger">{friendlyError(pay.error)}</p>
          )}
          <Button size="lg" fullWidth onClick={() => void pay.pay()} loading={pay.isPending}>
            {pay.isPending ? payLabel(pay.step) : `Pay my share · ${formatUsdc(share ?? 0n)}`}
          </Button>
          {pay.needsApproval && !pay.isOneTap && (
            <p className="mt-2 text-center text-xs text-content-subtle">
              Your wallet will ask twice: once to approve USDC, once to pay.
            </p>
          )}
        </div>
      );

    case "participant-paid":
      return (
        <Button size="lg" fullWidth variant="success" disabled>
          <CheckIcon />
          You&apos;ve paid
        </Button>
      );

    case "creator-can-withdraw":
      return (
        <Button size="lg" fullWidth onClick={onWithdraw}>
          Withdraw {formatUsdc(available)}
        </Button>
      );

    case "creator-awaiting":
      // With partial withdrawal on, the creator is only waiting for the first
      // payment — there is nothing to withdraw yet, not nobody left to pay.
      return (
        <Button size="lg" fullWidth disabled>
          {allowPartial ? "Waiting for the first payment" : "Waiting on everyone to pay"}
        </Button>
      );

    case "creator-settled":
      return (
        <Button size="lg" fullWidth variant="secondary" disabled>
          Withdrawn
        </Button>
      );

    default:
      return (
        <p className="py-3 text-center text-sm text-content-muted">
          {cancelled ? "Cancelled before anyone paid." : "You're not part of this split."}
        </p>
      );
  }
}

/**
 * `composeCast` only works inside the Base App / Farcaster Mini App host — it
 * talks to that host over postMessage, and outside a Mini App frame the app
 * ends up messaging itself, so the call hangs forever with no error. Split
 * links are opened by anyone, most of whom land here in a plain browser, so
 * this falls back to the Web Share API and finally to a clipboard copy.
 */
function ShareButton({splitId, title}: {splitId: string; title: string}) {
  const {isInMiniApp} = useIsInMiniApp();
  const {composeCast, error} = useComposeCast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) reportError("share split", error);
  }, [error]);

  const flash = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    const url = splitUrl(splitId);
    const invite = title
      ? `Splitting ${title} on PayFrens — grab your share 👇`
      : "Split this with me on PayFrens 👇";

    // Inside the Mini App host the cast composer keeps the two apart: `text` is
    // the cast body, `embeds` the link it unfurls.
    if (isInMiniApp) {
      composeCast({text: invite, embeds: [url]});
      return;
    }

    // Everywhere else the invite line rides in `title`, and `text` is never
    // sent. A Web Share target is free to flatten the payload into one string,
    // and Chrome on desktop puts `text` *after* the url — the recipient then
    // gets `…/split/0 Splitting drink buying…`, which resolves as
    // `/split/0%20Splitting%20drink%20buying…` and 404s. Nothing may follow the
    // url, so nothing is offered that could.
    const payload = {title: invite, url};

    if (typeof navigator !== "undefined" && navigator.share) {
      if (!navigator.canShare || navigator.canShare(payload)) {
        try {
          await navigator.share(payload);
          return;
        } catch (cause) {
          // A dismissed sheet is not a failure and needs no consolation copy.
          if (isAbort(cause)) return;
          // Anything else means the share never happened — fall through rather
          // than leave the button looking inert.
          reportError("share split", cause as Error);
        }
      }
    }

    if (await copyLink(url)) flash();
  };

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Share this split"}
      onClick={() => void handleShare()}
      className="flex size-9 items-center justify-center rounded-pill text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
    </button>
  );
}

/** The one rejection `navigator.share` makes that means "nothing went wrong". */
function isAbort(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

/** Copies the bare link, reporting rather than swallowing a refused clipboard. */
async function copyLink(url: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(url);
    return true;
  } catch (cause) {
    reportError("copy split link", cause as Error);
    return false;
  }
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <path
        d="M12 15.5V4m0 0L8 8m4-4 4 4M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function payLabel(step: ReturnType<typeof usePayShare>["step"]): string {
  if (step === "approving") return "Approving USDC…";
  if (step === "confirming") return "Confirming…";
  return "Paying…";
}

function safeId(id: string): bigint | undefined {
  try {
    const value = BigInt(id);
    return value >= 0n ? value : undefined;
  } catch {
    return undefined;
  }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <path
        d="M4 9a5 5 0 0 1 5-5h8m0 0-3-3m3 3-3 3M20 15a5 5 0 0 1-5 5H7m0 0 3 3m-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
