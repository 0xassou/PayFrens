"use client";

import {useQuery} from "@tanstack/react-query";
import type {Address} from "viem";

export type Profile = {
  address: Address;
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

/**
 * Resolves wallet addresses to Farcaster profiles so the participant list shows
 * faces and usernames rather than a column of hex.
 *
 * Batched into one request per screen: a ten-person split should not fire ten
 * lookups. Failure is non-fatal — `Avatar` falls back to initials, and the
 * split still works.
 */
export function useProfiles(addresses: readonly Address[] | undefined) {
  const key = (addresses ?? []).map((a) => a.toLowerCase()).sort();

  return useQuery({
    queryKey: ["profiles", key],
    enabled: key.length > 0,
    // Profile pictures change rarely; a stale avatar is much cheaper than a
    // request storm on every poll of the split.
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Record<string, Profile>> => {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({addresses: key}),
      });

      if (!response.ok) return {};
      return (await response.json()) as Record<string, Profile>;
    },
  });
}

/** Look one address up in the map `useProfiles` returns. */
export function profileFor(
  profiles: Record<string, Profile> | undefined,
  address: Address,
): Profile | undefined {
  return profiles?.[address.toLowerCase()];
}

/** Best available human label for an address. */
export function displayNameFor(profile: Profile | undefined): string | undefined {
  if (!profile) return undefined;
  if (profile.username) return `@${profile.username}`;
  return profile.displayName;
}
