"use client";

import type {Address} from "viem";
import {Avatar} from "@/components/ui/avatar";
import {cn} from "@/lib/cn";
import {formatUsdc, shortenAddress} from "@/lib/format";
import {displayNameFor, profileFor, type Profile} from "@/lib/hooks/use-profiles";
import {participantRows, type Split} from "@/lib/splits";

export function ParticipantList({
  split,
  profiles,
  viewer,
}: {
  split: Split;
  profiles?: Record<string, Profile>;
  viewer?: Address;
}) {
  const rows = participantRows(split);

  // Unpaid first: the point of this list is seeing who still owes.
  const ordered = [...rows].sort((a, b) => Number(a.paid) - Number(b.paid));

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {ordered.map((row) => {
        const profile = profileFor(profiles, row.address);
        const name = displayNameFor(profile);
        const isViewer = viewer && row.address.toLowerCase() === viewer.toLowerCase();

        return (
          <li key={row.address} className="flex items-center gap-3 px-3.5 py-3">
            <Avatar
              src={profile?.pfpUrl}
              name={name}
              address={row.address}
              paid={row.paid}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content">
                {name ?? shortenAddress(row.address)}
                {isViewer && <span className="ml-1.5 text-xs text-content-subtle">(you)</span>}
              </p>
              <p className={cn("text-xs", row.paid ? "text-success" : "text-content-subtle")}>
                {row.paid ? "Paid" : "Unpaid"}
              </p>
            </div>

            <span
              className={cn(
                "tabular text-sm font-semibold",
                row.paid ? "text-content-subtle line-through" : "text-content",
              )}
            >
              {formatUsdc(row.share)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
