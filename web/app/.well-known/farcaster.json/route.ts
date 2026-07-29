import {APP_NAME, APP_TAGLINE, APP_URL, absoluteUrl} from "@/lib/env";

/**
 * The mini-app manifest.
 *
 * `accountAssociation` proves this domain belongs to a Farcaster account. The
 * three values are produced by signing the domain on base.dev (or Warpcast's
 * manifest tool) and are read from the environment rather than committed — they
 * are specific to one deployment's domain, so a hardcoded copy would be wrong
 * on every other environment.
 *
 * Until they are set the manifest still serves, with the association empty; the
 * app runs, it just cannot be added or send notifications.
 */
export function GET() {
  const manifest = {
    accountAssociation: {
      header: process.env.FARCASTER_HEADER ?? "",
      payload: process.env.FARCASTER_PAYLOAD ?? "",
      signature: process.env.FARCASTER_SIGNATURE ?? "",
    },
    miniapp: {
      version: "1",
      name: APP_NAME,
      subtitle: "Split bills with frens",
      description:
        "Create a split, invite your frens, and everyone pays their share in USDC with one tap. " +
        "The creator withdraws once it's funded.",
      iconUrl: absoluteUrl("/icon.png"),
      homeUrl: APP_URL,
      imageUrl: absoluteUrl("/api/og"),
      splashImageUrl: absoluteUrl("/splash.png"),
      splashBackgroundColor: "#0A0E1A",
      webhookUrl: absoluteUrl("/api/webhook"),
      primaryCategory: "finance",
      tags: ["payments", "usdc", "base", "split", "bills"],
      tagline: APP_TAGLINE,
      ogTitle: APP_NAME,
      ogDescription: APP_TAGLINE,
      ogImageUrl: absoluteUrl("/api/og"),
      heroImageUrl: absoluteUrl("/api/og"),
      requiredChains: ["eip155:8453"],
      requiredCapabilities: [
        "actions.composeCast",
        "actions.addMiniApp",
        "wallet.getEthereumProvider",
      ],
    },
  };

  return Response.json(manifest, {
    headers: {"Cache-Control": "public, max-age=300"},
  });
}
