/** Canonical origin, no trailing slash. Everything shareable is built off this. */
export const APP_URL = (process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PayFrens";

export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE ?? "Split bills in USDC on Base";

export const ONCHAINKIT_API_KEY = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
