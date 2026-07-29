function clean(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Canonical origin, no trailing slash. Everything shareable — OG images, embed
 * metadata, the farcaster.json manifest — is built off this, so pointing at the
 * wrong origin silently breaks share cards rather than failing loudly.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_URL — set this to a custom domain once you have one.
 *  2. The Vercel production domain, stable across deployments.
 *  3. The per-deployment Vercel URL, so preview builds still resolve to
 *     themselves instead of localhost. This changes every deploy, which is why
 *     it ranks below the production domain.
 *  4. localhost, for local dev.
 *
 * Steps 2 and 3 rely on Vercel's "Automatically expose System Environment
 * Variables" setting, which is on by default.
 */
function resolveAppUrl(): string {
  const explicit = clean(process.env.NEXT_PUBLIC_URL);
  if (explicit) return explicit;

  const production = clean(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return `https://${production}`;

  const deployment = clean(process.env.NEXT_PUBLIC_VERCEL_URL);
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl().replace(/\/$/, "");

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PayFrens";

export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE ?? "Split bills in USDC on Base";

export const ONCHAINKIT_API_KEY = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
