"use client";

import {useState} from "react";
import {cn} from "@/lib/cn";

const SIZES = {
  sm: "size-7 text-[0.625rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

export type AvatarProps = {
  /** Farcaster / Base App profile picture, when we have one. */
  src?: string | null;
  /** Display name or username, used for the fallback initials. */
  name?: string | null;
  address?: string;
  size?: keyof typeof SIZES;
  /** Draws a mint ring — this participant has paid. */
  paid?: boolean;
  className?: string;
};

function initials(name?: string | null, address?: string): string {
  if (name) {
    const parts = name.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  // Address fallback: skip the 0x, which is the same for everyone.
  if (address) return address.slice(2, 4).toUpperCase();
  return "??";
}

export function Avatar({src, name, address, size = "md", paid = false, className}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-pill",
        "bg-surface-sunken text-content-muted",
        "flex items-center justify-center font-semibold",
        "ring-2",
        paid ? "ring-success" : "ring-border",
        SIZES[size],
        className,
      )}
      title={name ?? address}
    >
      {showImage ? (
        // Plain <img>: these URLs come from arbitrary Farcaster CDNs, and a
        // participant list is small enough that next/image's machinery costs
        // more than it saves.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? address ?? "Participant"}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true">{initials(name, address)}</span>
      )}
    </div>
  );
}

/** Overlapping row of avatars, with a `+N` chip once the group gets big. */
export function AvatarStack({
  people,
  max = 5,
  size = "md",
}: {
  people: Array<Omit<AvatarProps, "size">>;
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <div key={person.address ?? index} className={index > 0 ? "-ml-2" : undefined}>
          <Avatar {...person} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "-ml-2 flex items-center justify-center rounded-pill",
            "bg-surface-sunken text-content-muted font-semibold ring-2 ring-border",
            SIZES[size],
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
