"use client";

import {useMemo} from "react";
import {useAccount, useReadContract, useReadContracts} from "wagmi";
import type {Address} from "viem";
import {payFrensSplitterAbi} from "@/lib/abi/payFrensSplitter";
import {erc20Abi} from "@/lib/abi/erc20";
import {ACTIVE_CHAIN_ID, splitterAddress, usdcAddress} from "@/lib/chains";
import {toSplit, type RawSplitView, type Split} from "@/lib/splits";

/**
 * Reads route through a helper so a missing deploy address surfaces as a
 * disabled query rather than a thrown render.
 */
function contractConfig() {
  try {
    return {address: splitterAddress(), abi: payFrensSplitterAbi, chainId: ACTIVE_CHAIN_ID} as const;
  } catch {
    return null;
  }
}

export function useSplit(id?: bigint) {
  const config = contractConfig();

  const query = useReadContract({
    ...(config ?? {abi: payFrensSplitterAbi}),
    functionName: "getSplit",
    args: id === undefined ? undefined : [id],
    query: {
      enabled: Boolean(config) && id !== undefined,
      // A split changes when someone pays. Poll gently rather than leaving a
      // stale "2/3 paid" on screen while a friend is settling up next to you.
      refetchInterval: 12_000,
    },
  });

  const split = useMemo(
    () => (query.data ? toSplit(query.data as unknown as RawSplitView) : undefined),
    [query.data],
  );

  return {...query, split};
}

/** Batch read, for the history list. */
export function useSplitsByIds(ids: readonly bigint[] | undefined) {
  const config = contractConfig();

  const query = useReadContracts({
    contracts: (ids ?? []).map((id) => ({
      ...(config ?? {abi: payFrensSplitterAbi}),
      functionName: "getSplit" as const,
      args: [id] as const,
    })),
    query: {enabled: Boolean(config) && Boolean(ids?.length)},
  });

  const splits = useMemo(() => {
    if (!query.data) return undefined;
    return query.data
      .filter((result) => result.status === "success")
      .map((result) => toSplit(result.result as unknown as RawSplitView));
  }, [query.data]);

  return {...query, splits};
}

/**
 * Everything the connected wallet is involved in — splits they created and
 * splits they were invited to — newest first, deduplicated.
 *
 * Both id lists come straight off the contract, which is why this works with no
 * indexer and no backend.
 */
export function useMySplits(account?: Address) {
  const {address: connected} = useAccount();
  const owner = account ?? connected;
  const config = contractConfig();

  const idsQuery = useReadContracts({
    contracts: owner
      ? [
          {...(config ?? {abi: payFrensSplitterAbi}), functionName: "splitsCreatedBy", args: [owner]},
          {...(config ?? {abi: payFrensSplitterAbi}), functionName: "splitsJoinedBy", args: [owner]},
        ]
      : [],
    query: {enabled: Boolean(config) && Boolean(owner)},
  });

  const ids = useMemo(() => {
    const created = (idsQuery.data?.[0]?.result as readonly bigint[] | undefined) ?? [];
    const joined = (idsQuery.data?.[1]?.result as readonly bigint[] | undefined) ?? [];
    // Creator-and-participant is common; dedupe before fanning out reads.
    const merged = Array.from(new Set([...created, ...joined].map(String))).map(BigInt);
    return merged.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  }, [idsQuery.data]);

  const splitsQuery = useSplitsByIds(ids);

  return {
    ids,
    splits: splitsQuery.splits,
    isLoading: idsQuery.isLoading || splitsQuery.isLoading,
    isError: idsQuery.isError || splitsQuery.isError,
    refetch: () => {
      void idsQuery.refetch();
      void splitsQuery.refetch();
    },
  };
}

/** Net and fee for withdrawing this split right now, straight from the contract. */
export function useWithdrawalQuote(id?: bigint) {
  const config = contractConfig();

  const query = useReadContract({
    ...(config ?? {abi: payFrensSplitterAbi}),
    functionName: "quoteWithdrawal",
    args: id === undefined ? undefined : [id],
    query: {enabled: Boolean(config) && id !== undefined},
  });

  const [net, fee] = (query.data as readonly [bigint, bigint] | undefined) ?? [undefined, undefined];
  return {...query, net, fee};
}

export function useUsdcAllowance(owner?: Address) {
  let spender: Address | undefined;
  try {
    spender = splitterAddress();
  } catch {
    spender = undefined;
  }

  return useReadContract({
    address: usdcAddress(),
    abi: erc20Abi,
    chainId: ACTIVE_CHAIN_ID,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: {enabled: Boolean(owner && spender)},
  });
}

export function useUsdcBalance(owner?: Address) {
  return useReadContract({
    address: usdcAddress(),
    abi: erc20Abi,
    chainId: ACTIVE_CHAIN_ID,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: {enabled: Boolean(owner)},
  });
}

export type {Split};
