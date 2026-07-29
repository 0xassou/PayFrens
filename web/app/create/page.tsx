"use client";

import {useRouter, useSearchParams} from "next/navigation";
import {Suspense, useEffect, useMemo, useState} from "react";
import {useAccount} from "wagmi";
import type {Address} from "viem";
import {AppShell} from "@/components/app-shell";
import {
  ParticipantInput,
  evenShares,
  formatEvenShare,
  type Entry,
} from "@/components/split/participant-input";
import {Button} from "@/components/ui/button";
import {Field, Input} from "@/components/ui/field";
import {Spinner} from "@/components/ui/spinner";
import {Toggle} from "@/components/ui/toggle";
import {cn} from "@/lib/cn";
import {formatUsdc, parseUsdc} from "@/lib/format";
import {useMiniAppReady} from "@/lib/hooks/use-mini-app";
import {useProfiles} from "@/lib/hooks/use-profiles";
import {useCreateSplit} from "@/lib/hooks/use-split-actions";
import {useSplit} from "@/lib/hooks/use-splits";
import {friendlyError, reportError} from "@/lib/errors";

type Mode = "even" | "custom";

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <AppShell back="/" title="New split">
          <div className="flex justify-center py-24 text-content-subtle">
            <Spinner />
          </div>
        </AppShell>
      }
    >
      <CreateScreen />
    </Suspense>
  );
}

function CreateScreen() {
  useMiniAppReady();

  const router = useRouter();
  const params = useSearchParams();
  const {address, isConnected} = useAccount();

  const [mode, setMode] = useState<Mode>("even");
  const [totalInput, setTotalInput] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);

  // "Run it back with the same group": /create?from=<splitId> copies the roster
  // (and the title) off an existing split so a repeat dinner is one tap.
  const fromId = params.get("from");
  const {split: source} = useSplit(fromId ? BigInt(fromId) : undefined);

  // The seed is derived from the fetched split rather than copied into state by
  // an effect; the edited value simply takes over the moment the user touches
  // anything. No post-fetch setState, so no cascading render.
  const [editedEntries, setEntries] = useState<Entry[] | null>(null);
  const [editedTitle, setTitle] = useState<string | null>(null);

  const seededEntries = useMemo<Entry[]>(
    () => source?.participants.map((participant) => ({address: participant, share: ""})) ?? [],
    [source],
  );

  const entries = editedEntries ?? seededEntries;
  const title = editedTitle ?? (source?.title ? `${source.title} (again)` : "");

  const {data: profiles} = useProfiles(entries.map((entry) => entry.address));
  const {create, createdId, isPending, error} = useCreateSplit();

  const total = useMemo(() => {
    if (mode === "even") return parseUsdc(totalInput) ?? 0n;
    return entries.reduce((sum, entry) => sum + (parseUsdc(entry.share) ?? 0n), 0n);
  }, [entries, mode, totalInput]);

  const problem = validate({mode, entries, total, totalInput, isConnected});

  useEffect(() => {
    if (createdId !== null) router.push(`/split/${createdId}`);
  }, [createdId, router]);

  async function submit() {
    if (problem) return;

    const participants = entries.map((entry) => entry.address as Address);

    try {
      await create(
        mode === "even"
          ? {title: title.trim(), participants, total, allowPartialWithdraw: allowPartial}
          : {
              title: title.trim(),
              participants,
              shares: entries.map((entry) => parseUsdc(entry.share) ?? 0n),
              allowPartialWithdraw: allowPartial,
            },
      );
    } catch (cause) {
      // The hook already stores this for the banner. Caught here so it does not
      // escape as an unhandled rejection, and logged so the underlying cause is
      // one console open away rather than lost behind the friendly copy.
      reportError("createSplit failed", cause as Error);
    }
  }

  return (
    <AppShell back="/" title="New split">
      <div className="space-y-5 pb-32">
        <Field label="What's it for?">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Dinner at Septime"
            maxLength={128}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-content">How to split</span>
          <div className="flex gap-1 rounded-card border border-border bg-surface-sunken p-1">
            <ModeButton active={mode === "even"} onClick={() => setMode("even")}>
              Evenly
            </ModeButton>
            <ModeButton active={mode === "custom"} onClick={() => setMode("custom")}>
              Custom amounts
            </ModeButton>
          </div>
        </div>

        {mode === "even" && (
          <Field
            label="Total amount"
            hint={
              entries.length > 0 && total > 0n
                ? `${formatEvenShare(total, entries.length)} each`
                : "In USDC."
            }
          >
            <div className="relative">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-content-subtle">
                $
              </span>
              <Input
                value={totalInput}
                onChange={(event) => setTotalInput(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular pl-7"
              />
            </div>
          </Field>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-content">
            Who&apos;s in{entries.length > 0 && ` (${entries.length})`}
          </span>
          <ParticipantInput
            entries={entries}
            onChange={setEntries}
            custom={mode === "custom"}
            profiles={profiles}
          />
          {address && !entries.some((e) => e.address.toLowerCase() === address.toLowerCase()) && (
            <button
              type="button"
              onClick={() => setEntries([...entries, {address, share: ""}])}
              className="mt-2 text-xs font-medium text-accent"
            >
              + Add myself
            </button>
          )}
        </div>

        {/* Sets `allowPartialWithdraw` on the split. It is fixed at creation —
            the contract has no setter — so the consequence is spelled out here,
            while it can still be changed. */}
        <Toggle
          checked={allowPartial}
          onChange={setAllowPartial}
          label="Allow partial withdrawal"
          description="Off by default: you close the split in one go, once everyone has paid."
          activeDescription="You'll be able to withdraw as people pay, even if not everyone has settled up yet."
        />

        {error && (
          <p className="rounded-card bg-danger-subtle px-3.5 py-3 text-sm text-danger">
            {friendlyError(error)}
          </p>
        )}
      </div>

      {/* Sticky footer: the summary and the commit button stay in the thumb's
          reach however long the roster gets. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border bg-app/90 px-4 pt-3 pb-safe backdrop-blur-lg">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="text-sm text-content-muted">Total</span>
          <span className="tabular text-lg font-bold text-content">{formatUsdc(total)}</span>
        </div>

        <Button size="lg" fullWidth onClick={submit} loading={isPending} disabled={Boolean(problem)}>
          {problem ?? "Create split"}
        </Button>
      </div>
    </AppShell>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[0.75rem] py-2 text-sm font-medium transition-colors",
        active ? "bg-surface text-content shadow-card" : "text-content-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Returns the reason the split cannot be created yet, which doubles as the
 * button's label — the user always sees what is missing instead of a dead
 * button with no explanation.
 */
function validate({
  mode,
  entries,
  total,
  totalInput,
  isConnected,
}: {
  mode: Mode;
  entries: Entry[];
  total: bigint;
  totalInput: string;
  isConnected: boolean;
}): string | null {
  // Checked first: without a wallet the write reverts with
  // ConnectorNotConnectedError before a transaction is ever built, and no
  // amount of retrying fixes it. Outside Base App — a desktop browser, say —
  // nothing connects automatically, so this is the common case rather than the
  // edge one.
  if (!isConnected) return "Connect your wallet";

  if (entries.length === 0) return "Add someone";

  if (mode === "even") {
    if (totalInput.trim() !== "" && parseUsdc(totalInput) === null) return "Enter a valid amount";
    if (total <= 0n) return "Enter an amount";
    // The contract rejects a zero share, so catch it before the wallet opens.
    if (evenShares(total, entries.length).some((share) => share <= 0n)) {
      return "Amount is too small to split";
    }
    return null;
  }

  if (entries.some((entry) => parseUsdc(entry.share) === null)) return "Enter a valid amount";
  if (entries.some((entry) => (parseUsdc(entry.share) ?? 0n) <= 0n)) return "Everyone needs a share";
  if (total <= 0n) return "Enter amounts";

  return null;
}

