"use client";

import {useState} from "react";
import {isAddress, type Address} from "viem";
import {Avatar} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {inputStyles} from "@/components/ui/field";
import {cn} from "@/lib/cn";
import {formatUsdc, parseUsdc, shortenAddress} from "@/lib/format";
import {displayNameFor, profileFor, type Profile} from "@/lib/hooks/use-profiles";

export type Entry = {
  address: Address;
  /** Only used in custom mode; ignored for an even split. */
  share: string;
};

/**
 * The roster editor. Accepts a wallet address, or an `@username` which is
 * resolved server-side against Farcaster — the people you split bills with are
 * usually names to you, not hex.
 */
export function ParticipantInput({
  entries,
  onChange,
  custom,
  profiles,
}: {
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  custom: boolean;
  profiles?: Record<string, Profile>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function add() {
    const value = draft.trim();
    if (!value) return;

    setError(null);

    let address: Address | null = null;

    if (isAddress(value)) {
      address = value as Address;
    } else {
      setResolving(true);
      address = await resolveUsername(value);
      setResolving(false);

      if (!address) {
        setError(`Couldn't find "${value}". Try a wallet address.`);
        return;
      }
    }

    // The contract rejects duplicates, but failing here costs no gas.
    if (entries.some((entry) => entry.address.toLowerCase() === address.toLowerCase())) {
      setError("They're already in this split.");
      return;
    }

    onChange([...entries, {address, share: ""}]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
          placeholder="@username or 0x…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(inputStyles, "flex-1")}
        />
        <Button type="button" onClick={add} loading={resolving} disabled={!draft.trim()}>
          Add
        </Button>
      </div>

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}

      {entries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {entries.map((entry, index) => {
            const profile = profileFor(profiles, entry.address);
            const name = displayNameFor(profile);

            return (
              <li
                key={entry.address}
                className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5"
              >
                <Avatar src={profile?.pfpUrl} name={name} address={entry.address} size="md" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">
                    {name ?? shortenAddress(entry.address)}
                  </p>
                  {name && (
                    <p className="truncate text-xs text-content-subtle">
                      {shortenAddress(entry.address)}
                    </p>
                  )}
                </div>

                {custom && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-content-subtle">$</span>
                    <input
                      value={entry.share}
                      onChange={(event) => {
                        const next = [...entries];
                        next[index] = {...entry, share: event.target.value};
                        onChange(next);
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Amount for ${name ?? shortenAddress(entry.address)}`}
                      className={cn(
                        "tabular w-20 rounded-[0.625rem] border border-border bg-surface-sunken",
                        "px-2 py-1.5 text-right text-base text-content",
                        "focus:border-accent focus:outline-none",
                        entry.share !== "" && parseUsdc(entry.share) === null && "border-danger",
                      )}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}
                  aria-label={`Remove ${name ?? shortenAddress(entry.address)}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-pill text-content-subtle transition-colors hover:bg-danger-subtle hover:text-danger"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Per-person amount preview for an even split, including the remainder. */
export function evenShares(total: bigint, count: number): bigint[] {
  if (count <= 0 || total <= 0n) return [];

  const base = total / BigInt(count);
  const remainder = Number(total % BigInt(count));

  // Matches the contract exactly: the leftover base units go to the front of
  // the list, so what the UI previews is what gets written on chain.
  return Array.from({length: count}, (_, index) => (index < remainder ? base + 1n : base));
}

export function formatEvenShare(total: bigint, count: number): string {
  const shares = evenShares(total, count);
  if (shares.length === 0) return formatUsdc(0n);

  const first = shares[0];
  const last = shares[shares.length - 1];

  // "$10" when it divides cleanly, "$10 – $10.000001" when it does not.
  return first === last ? formatUsdc(first) : `${formatUsdc(last)} – ${formatUsdc(first)}`;
}

async function resolveUsername(value: string): Promise<Address | null> {
  try {
    const response = await fetch("/api/profiles/resolve", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({query: value.replace(/^@/, "")}),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {address?: Address};
    return data.address ?? null;
  } catch {
    return null;
  }
}
