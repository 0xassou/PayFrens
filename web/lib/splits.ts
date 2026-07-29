import type {Address} from "viem";

/** Mirrors `PayFrensSplitter.SplitStatus`. */
export enum SplitStatus {
  None = 0,
  Open = 1,
  Cancelled = 2,
}

/** Decoded `SplitView` from the contract, plus derived fields the UI wants. */
export type Split = {
  id: bigint;
  creator: Address;
  title: string;
  totalAmount: bigint;
  amountPaid: bigint;
  amountWithdrawn: bigint;
  createdAt: number;
  participantCount: number;
  paidCount: number;
  allowPartialWithdraw: boolean;
  status: SplitStatus;
  participants: readonly Address[];
  shares: readonly bigint[];
  paidFlags: readonly boolean[];
};

/** Raw tuple shape viem decodes `getSplit` into. */
export type RawSplitView = {
  id: bigint;
  creator: Address;
  title: string;
  totalAmount: bigint;
  amountPaid: bigint;
  amountWithdrawn: bigint;
  createdAt: bigint;
  participantCount: bigint;
  paidCount: bigint;
  allowPartialWithdraw: boolean;
  status: number;
  participants: readonly Address[];
  shares: readonly bigint[];
  paidFlags: readonly boolean[];
};

export function toSplit(raw: RawSplitView): Split {
  return {
    ...raw,
    createdAt: Number(raw.createdAt),
    participantCount: Number(raw.participantCount),
    paidCount: Number(raw.paidCount),
    status: raw.status as SplitStatus,
  };
}

export type ParticipantRow = {
  address: Address;
  share: bigint;
  paid: boolean;
};

export function participantRows(split: Split): ParticipantRow[] {
  return split.participants.map((address, index) => ({
    address,
    share: split.shares[index] ?? 0n,
    paid: split.paidFlags[index] ?? false,
  }));
}

export function isFullyPaid(split: Split): boolean {
  return split.totalAmount > 0n && split.amountPaid >= split.totalAmount;
}

export function outstanding(split: Split): bigint {
  const remaining = split.totalAmount - split.amountPaid;
  return remaining > 0n ? remaining : 0n;
}

/** What is sitting in the contract for this split, not yet withdrawn. */
export function withdrawable(split: Split): bigint {
  const available = split.amountPaid - split.amountWithdrawn;
  return available > 0n ? available : 0n;
}

export function shareOf(split: Split, account?: Address): bigint | null {
  if (!account) return null;
  const index = indexOf(split, account);
  return index === -1 ? null : (split.shares[index] ?? 0n);
}

export function hasPaid(split: Split, account?: Address): boolean {
  if (!account) return false;
  const index = indexOf(split, account);
  return index !== -1 && (split.paidFlags[index] ?? false);
}

function indexOf(split: Split, account: Address): number {
  const target = account.toLowerCase();
  return split.participants.findIndex((address) => address.toLowerCase() === target);
}

/**
 * What this viewer should be shown, and therefore which action the screen leads
 * with. Deliberately one value rather than a pile of booleans scattered through
 * the JSX — the whole screen hangs off it.
 */
export type ViewerRole =
  | "creator-awaiting" // created it, people still owe
  | "creator-can-withdraw" // created it, money is collectable
  | "creator-settled" // created it, already withdrawn
  | "participant-owes" // in it, hasn't paid
  | "participant-paid" // in it, has paid
  | "refundable" // cancelled, and this viewer is owed money back
  | "observer"; // not involved, or not connected

export function viewerRole(split: Split, account?: Address): ViewerRole {
  const isCreator = Boolean(account && split.creator.toLowerCase() === account.toLowerCase());
  const inSplit = Boolean(account && indexOf(split, account) !== -1);
  const paid = hasPaid(split, account);

  if (split.status === SplitStatus.Cancelled) {
    return inSplit && paid ? "refundable" : "observer";
  }

  if (isCreator) {
    if (withdrawable(split) > 0n && (isFullyPaid(split) || split.allowPartialWithdraw)) {
      return "creator-can-withdraw";
    }
    if (split.amountWithdrawn > 0n && withdrawable(split) === 0n) return "creator-settled";
    // A creator who is also a participant and still owes should be asked to pay
    // before being told to wait for everyone else.
    if (inSplit && !paid) return "participant-owes";
    return "creator-awaiting";
  }

  if (inSplit) return paid ? "participant-paid" : "participant-owes";
  return "observer";
}
