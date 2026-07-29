/**
 * USDC amounts are `bigint` base units everywhere in this app — 6 decimals, so
 * 1 USDC is 1_000_000n. Floats never touch a monetary value; they are only
 * produced at the very edge, for display.
 */

export const USDC_DECIMALS = 6;
const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);

/**
 * Format for display. Whole amounts lose their decimals ("$24" not "$24.00")
 * because that is how people say them; anything with cents keeps two places,
 * and sub-cent dust keeps enough digits to stay honest rather than rounding to
 * "$0.00".
 */
export function formatUsdc(
  amount: bigint,
  options: {symbol?: boolean; maximumFractionDigits?: number} = {},
): string {
  const {symbol = true, maximumFractionDigits} = options;

  const negative = amount < 0n;
  const abs = negative ? -amount : amount;

  const whole = abs / USDC_UNIT;
  const fraction = abs % USDC_UNIT;

  let decimals: number;
  if (maximumFractionDigits !== undefined) {
    decimals = maximumFractionDigits;
  } else if (fraction === 0n) {
    decimals = 0;
  } else if (fraction % 10_000n === 0n) {
    decimals = 2;
  } else {
    // Trim trailing zeros, but never below two places.
    const padded = fraction.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
    decimals = Math.max(2, padded.length);
  }

  const scaled = decimals >= USDC_DECIMALS ? fraction : fraction / 10n ** BigInt(USDC_DECIMALS - decimals);

  const wholeText = whole.toLocaleString("en-US");
  const body =
    decimals === 0 ? wholeText : `${wholeText}.${scaled.toString().padStart(decimals, "0")}`;

  return `${negative ? "-" : ""}${symbol ? "$" : ""}${body}`;
}

/**
 * Parse user input into base units. Returns null rather than throwing, because
 * this runs on every keystroke in the amount field.
 */
export function parseUsdc(input: string): bigint | null {
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (trimmed === "") return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > USDC_DECIMALS) return null;

  const padded = fraction.padEnd(USDC_DECIMALS, "0");
  try {
    return BigInt(whole || "0") * USDC_UNIT + BigInt(padded || "0");
  } catch {
    return null;
  }
}

/** Percentage complete, clamped and rounded, for progress bars. */
export function percentOf(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0;
  const pct = Number((part * 10_000n) / whole) / 100;
  return Math.max(0, Math.min(100, pct));
}

/** `0x1234…abcd` */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/** "just now", "3h ago", "12 Mar" — the resolution people actually want. */
export function relativeTime(timestampSeconds: number, now = Date.now()): string {
  const seconds = Math.floor(now / 1000) - timestampSeconds;

  if (seconds < 60) return "just now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return new Date(timestampSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
