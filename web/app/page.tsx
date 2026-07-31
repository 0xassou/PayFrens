"use client";

import {useIsInMiniApp} from "@coinbase/onchainkit/minikit";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {useAccount} from "wagmi";
import {AppShell} from "@/components/app-shell";
import {CelebrationVisual, EmptyState} from "@/components/empty-state";
import {Landing} from "@/components/home/landing";
import {SplitStats} from "@/components/home/split-stats";
import {SplitCard} from "@/components/split/split-card";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {formatUsdc} from "@/lib/format";
import {useMiniAppReady} from "@/lib/hooks/use-mini-app";
import {useProfiles} from "@/lib/hooks/use-profiles";
import {useMySplits} from "@/lib/hooks/use-splits";
import {outstanding, SplitStatus, type Split} from "@/lib/splits";

/**
 * How long to wait for the mini-app question to settle before showing the
 * landing anyway. `sdk.isInMiniApp()` gives up after 1s of its own, so this only
 * fires when detection or auto-connect never answers at all — at which point a
 * Connect button is more use than an indefinite spinner.
 */
const CONNECT_GRACE_MS = 1_500;

export default function HomePage() {
  const {user} = useMiniAppReady();
  const {address, isConnected} = useAccount();
  const {splits, isLoading} = useMySplits(address);

  // Everyone across every split, deduped, so avatars come from one request.
  const everyone = useMemo(() => {
    const seen = new Map<string, `0x${string}`>();
    for (const split of splits ?? []) {
      for (const participant of split.participants) seen.set(participant.toLowerCase(), participant);
    }
    return [...seen.values()];
  }, [splits]);

  const {data: profiles} = useProfiles(everyone);

  const {owed, active, past} = useMemo(() => partition(splits, address), [splits, address]);

  const totalOwed = owed.reduce((sum, split) => {
    const index = split.participants.findIndex(
      (participant) => participant.toLowerCase() === address?.toLowerCase(),
    );
    return index === -1 ? sum : sum + (split.shares[index] ?? 0n);
  }, 0n);

  const volume = (splits ?? []).reduce((sum, split) => sum + split.totalAmount, 0n);

  /*
   * Inside Base App the wallet attaches on its own a beat after mount. Throwing
   * a full pitch on screen in that gap and yanking it away again is worse than
   * a moment of nothing, so the landing waits until we know we are *outside*
   * Base App — the same "don't guess while detection is pending" rule the old
   * connect fallback followed. Outside a frame `isInMiniApp` resolves false on
   * the first tick, so in a normal browser this costs a frame, not a wait.
   */
  const {isInMiniApp} = useIsInMiniApp();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGraceElapsed(true), CONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isConnected) {
    return (
      <AppShell>
        {isInMiniApp === false || graceElapsed ? (
          <Landing />
        ) : (
          <div className="flex justify-center py-24 text-content-subtle">
            <Spinner />
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mt-1 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-content">
          {user?.displayName ? `Hey ${user.displayName.split(" ")[0]}` : "Your splits"}
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          {totalOwed > 0n
            ? `You owe ${formatUsdc(totalOwed)} across ${owed.length} split${owed.length === 1 ? "" : "s"}.`
            : "Everything's settled up."}
        </p>
      </div>

      <div className="mb-4">
        <SplitStats active={owed.length + active.length} settled={past.length} volume={volume} />
      </div>

      <Link href="/create" className="mb-6 block">
        <Button size="lg" fullWidth>
          <PlusIcon />
          New split
        </Button>
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-12 text-content-subtle">
          <Spinner />
        </div>
      ) : !splits?.length ? (
        // Nothing outstanding is the happy ending of this app, not an absence
        // of content — so it gets the mint treatment rather than a grey box.
        <EmptyState
          visual={<CelebrationVisual />}
          title="All settled up"
          description="Nobody owes anybody. Start a split for the next dinner, taxi or group gift and we'll keep score."
        />
      ) : (
        <div className="space-y-6">
          {owed.length > 0 && (
            <Section title="You owe" count={owed.length}>
              {owed.map((split) => (
                <SplitCard
                  key={String(split.id)}
                  split={split}
                  profiles={profiles}
                  viewer={address}
                />
              ))}
            </Section>
          )}

          {active.length > 0 && (
            <Section title="In progress" count={active.length}>
              {active.map((split) => (
                <SplitCard
                  key={String(split.id)}
                  split={split}
                  profiles={profiles}
                  viewer={address}
                />
              ))}
            </Section>
          )}

          {past.length > 0 && (
            <Section title="History" count={past.length}>
              {past.map((split) => (
                <SplitCard
                  key={String(split.id)}
                  split={split}
                  profiles={profiles}
                  viewer={address}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <div className="h-8" />
    </AppShell>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-content-subtle uppercase">
        {title}
        <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem]">
          {count}
        </span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

/**
 * Sorts splits into what the user must act on, what is still running, and what
 * is finished. "You owe" comes first because it is the only bucket with a
 * deadline attached to it socially.
 */
function partition(splits: Split[] | undefined, address?: `0x${string}`) {
  const owed: Split[] = [];
  const active: Split[] = [];
  const past: Split[] = [];

  for (const split of splits ?? []) {
    const finished =
      split.status === SplitStatus.Cancelled ||
      (split.amountWithdrawn > 0n && outstanding(split) === 0n);

    if (finished) {
      past.push(split);
      continue;
    }

    const index = address
      ? split.participants.findIndex((p) => p.toLowerCase() === address.toLowerCase())
      : -1;

    if (index !== -1 && !split.paidFlags[index]) owed.push(split);
    else active.push(split);
  }

  return {owed, active, past};
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}
