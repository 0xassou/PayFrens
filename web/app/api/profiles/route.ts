import type {Address} from "viem";

/**
 * Resolves wallet addresses to Farcaster profiles for the avatars.
 *
 * Backed by Neynar when `NEYNAR_API_KEY` is set. Without a key it returns an
 * empty map, and every avatar falls back to initials — the app is fully usable,
 * it just looks less social. That degradation is deliberate: nothing here is
 * load-bearing for moving money.
 */
export async function POST(request: Request) {
  let body: {addresses?: string[]};

  try {
    body = await request.json();
  } catch {
    return Response.json({}, {status: 400});
  }

  const addresses = (body.addresses ?? []).filter((value) => /^0x[0-9a-fA-F]{40}$/.test(value));
  if (addresses.length === 0) return Response.json({});

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return Response.json({});

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses.join(",")}`,
      {
        headers: {"x-api-key": apiKey, accept: "application/json"},
        // Avatars change rarely and this is on the render path for every split.
        next: {revalidate: 600},
      },
    );

    if (!response.ok) return Response.json({});

    const data = (await response.json()) as Record<string, NeynarUser[]>;
    const profiles: Record<string, unknown> = {};

    for (const [address, users] of Object.entries(data)) {
      const user = users?.[0];
      if (!user) continue;

      profiles[address.toLowerCase()] = {
        address: address as Address,
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      };
    }

    return Response.json(profiles, {
      headers: {"Cache-Control": "private, max-age=300"},
    });
  } catch {
    return Response.json({});
  }
}

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};
