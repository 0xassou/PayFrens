import "server-only";
import {createPublicClient, http, type Address} from "viem";
import {payFrensSplitterAbi} from "@/lib/abi/payFrensSplitter";
import {ACTIVE_CHAIN, ACTIVE_CHAIN_ID, SPLITTER_ADDRESS} from "@/lib/chains";
import {toSplit, type RawSplitView, type Split} from "@/lib/splits";

/**
 * Server-side reader, used by the OG image routes and by the notification
 * dispatcher. Separate from the wagmi client because those run with no wallet
 * and no React.
 *
 * Falls back to the chain's public RPC, which is rate-limited — set `RPC_URL`
 * to a dedicated provider before the share cards see any real traffic, since
 * every feed impression is a read.
 */
export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(process.env.RPC_URL),
});

/**
 * Reads a split for rendering a share card. Returns null instead of throwing:
 * an unfurl for a nonexistent id should degrade to the generic card, not a 500
 * in someone's feed.
 */
export async function readSplit(id: bigint): Promise<Split | null> {
  const address = SPLITTER_ADDRESS[ACTIVE_CHAIN_ID];
  if (!address) return null;

  try {
    const raw = await publicClient.readContract({
      address: address as Address,
      abi: payFrensSplitterAbi,
      functionName: "getSplit",
      args: [id],
    });

    return toSplit(raw as unknown as RawSplitView);
  } catch {
    return null;
  }
}
