"use client";

import Link from "next/link";
import type {Address} from "viem";
import {AvatarStack} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {ProgressBar} from "@/components/ui/progress-bar";
import {formatUsdc, relativeTime} from "@/lib/format";
import {displayNameFor, profileFor, type Profile} from "@/lib/hooks/use-profiles";
import {isFullyPaid, SplitStatus, type Split} from "@/lib/splits";

/** A split as it appears in the history list. */
export function SplitCard({
  split,
  profiles,
  viewer,
}: {
  split: Split;
  profiles?: Record<string, Profile>;
  viewer?: Address;
}) {
  const complete = isFullyPaid(split);
  const cancelled = split.status === SplitStatus.Cancelled;
  const settled = split.amountWithdrawn > 0n && split.amountWithdrawn >= split.amountPaid;

  const owesIt =
    viewer &&
    split.participants.some(
      (address, index) =>
        address.toLowerCase() === viewer.toLowerCase() && !split.paidFlags[index],
    ) &&
    !cancelled;

  const people = split.participants.map((address, index) => {
    const profile = profileFor(profiles, address);
    return {
      address,
      src: profile?.pfpUrl,
      name: displayNameFor(profile),
      paid: split.paidFlags[index] ?? false,
    };
  });

  return (
    <Link
      href={`/split/${split.id}`}
      className="block rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-hover active:bg-surface-hover"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] font-semibold text-content">
            {split.title || `Split #${split.id}`}
          </h3>
          <p className="mt-0.5 text-xs text-content-subtle">
            {relativeTime(split.createdAt)} · {split.participantCount} people
          </p>
        </div>

        <span className="tabular shrink-0 text-[0.9375rem] font-semibold text-content">
          {formatUsdc(split.totalAmount)}
        </span>
      </div>

      <ProgressBar
        paid={split.amountPaid}
        total={split.totalAmount}
        label={`${split.paidCount} of ${split.participantCount} paid`}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <AvatarStack people={people} size="sm" max={5} />

        {/* Only one badge: the most actionable thing about this split. */}
        {cancelled ? (
          <Badge tone="danger">Cancelled</Badge>
        ) : owesIt ? (
          <Badge tone="accent">You owe</Badge>
        ) : settled ? (
          <Badge tone="neutral">Withdrawn</Badge>
        ) : complete ? (
          <Badge tone="success">Fully paid</Badge>
        ) : (
          <Badge tone="neutral">
            {split.paidCount}/{split.participantCount} paid
          </Badge>
        )}
      </div>
    </Link>
  );
}
