import type {Address} from "viem";

/**
 * Turns an `@username` into the wallet address to bill.
 *
 * Picks the user's primary verified Ethereum address — the one they proved
 * ownership of — rather than their custody address, because that is the wallet
 * they actually hold funds in. Without a Neynar key this returns 404 and the
 * create screen tells the user to paste an address instead.
 */
export async function POST(request: Request) {
  let body: {query?: string};

  try {
    body = await request.json();
  } catch {
    return Response.json({error: "Invalid JSON"}, {status: 400});
  }

  const username = body.query?.trim().replace(/^@/, "");
  if (!username) return Response.json({error: "Missing query"}, {status: 400});

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return Response.json({error: "Lookup unavailable"}, {status: 404});

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
      {
        headers: {"x-api-key": apiKey, accept: "application/json"},
        next: {revalidate: 300},
      },
    );

    if (!response.ok) return Response.json({error: "Not found"}, {status: 404});

    const data = (await response.json()) as {user?: NeynarUser};
    const user = data.user;

    const address =
      user?.verified_addresses?.primary?.eth_address ??
      user?.verified_addresses?.eth_addresses?.[0] ??
      user?.custody_address;

    if (!address) return Response.json({error: "No wallet found"}, {status: 404});

    return Response.json({
      address: address as Address,
      fid: user?.fid,
      username: user?.username,
      displayName: user?.display_name,
      pfpUrl: user?.pfp_url,
    });
  } catch {
    return Response.json({error: "Lookup failed"}, {status: 502});
  }
}

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
  verified_addresses?: {
    eth_addresses?: string[];
    primary?: {eth_address?: string};
  };
};
