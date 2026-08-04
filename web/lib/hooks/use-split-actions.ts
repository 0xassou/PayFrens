"use client";

import {useCallback, useState} from "react";
import {decodeEventLog, type Address} from "viem";
import {useWaitForTransactionReceipt, useWriteContract} from "wagmi";
import {payFrensSplitterAbi} from "@/lib/abi/payFrensSplitter";
import {ACTIVE_CHAIN_ID, splitterAddress} from "@/lib/chains";

/** Shared plumbing for the single-call writes: send, wait, expose the state. */
function useContractAction() {
  const [error, setError] = useState<Error | null>(null);
  const {writeContractAsync, isPending: isSigning} = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const receipt = useWaitForTransactionReceipt({hash, query: {enabled: Boolean(hash)}});

  return {
    error,
    setError,
    hash,
    setHash,
    writeContractAsync,
    receipt,
    isPending: isSigning || receipt.isLoading,
    isSuccess: receipt.data?.status === "success",
  };
}

export function useCreateSplit() {
  const action = useContractAction();
  const [splitId, setSplitId] = useState<bigint | null>(null);

  const create = useCallback(
    async (input: {
      title: string;
      participants: Address[];
      /** Even split: pass a total. Custom split: pass one share per participant. */
      total?: bigint;
      shares?: bigint[];
      allowPartialWithdraw?: boolean;
    }) => {
      action.setError(null);
      setSplitId(null);

      try {
        const address = splitterAddress();
        const allowPartial = input.allowPartialWithdraw ?? false;

        const hash = input.shares
          ? await action.writeContractAsync({
              address,
              abi: payFrensSplitterAbi,
              functionName: "createSplit",
              args: [input.title, input.participants, input.shares, allowPartial],
              chainId: ACTIVE_CHAIN_ID,
            })
          : await action.writeContractAsync({
              address,
              abi: payFrensSplitterAbi,
              functionName: "createEvenSplit",
              args: [input.title, input.participants, input.total ?? 0n, allowPartial],
              chainId: ACTIVE_CHAIN_ID,
            });

        action.setHash(hash);
        return hash;
      } catch (cause) {
        action.setError(cause as Error);
        throw cause;
      }
    },
    [action],
  );

  // The new id only exists in the receipt — read it back off SplitCreated so we
  // can navigate straight to the split the user just made.
  const createdId = (() => {
    if (splitId !== null) return splitId;

    const logs = action.receipt.data?.logs;
    if (!logs) return null;

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({abi: payFrensSplitterAbi, ...log});
        if (decoded.eventName === "SplitCreated") {
          const id = (decoded.args as {splitId: bigint}).splitId;
          setSplitId(id);
          return id;
        }
      } catch {
        // Not one of ours — the receipt also carries the USDC logs.
      }
    }
    return null;
  })();

  return {
    create,
    createdId,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.isSuccess,
    hash: action.hash,
  };
}

export function useWithdraw(splitId?: bigint) {
  const action = useContractAction();

  const withdraw = useCallback(async () => {
    if (splitId === undefined) return;
    action.setError(null);

    try {
      const hash = await action.writeContractAsync({
        address: splitterAddress(),
        abi: payFrensSplitterAbi,
        functionName: "withdraw",
        args: [splitId],
        chainId: ACTIVE_CHAIN_ID,
      });
      action.setHash(hash);
      return hash;
    } catch (cause) {
      action.setError(cause as Error);
      throw cause;
    }
  }, [action, splitId]);

  return {
    withdraw,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.isSuccess,
    hash: action.hash,
  };
}

export function useCancelSplit(splitId?: bigint) {
  const action = useContractAction();

  const cancel = useCallback(async () => {
    if (splitId === undefined) return;
    action.setError(null);

    try {
      const hash = await action.writeContractAsync({
        address: splitterAddress(),
        abi: payFrensSplitterAbi,
        functionName: "cancel",
        args: [splitId],
        chainId: ACTIVE_CHAIN_ID,
      });
      action.setHash(hash);
      return hash;
    } catch (cause) {
      action.setError(cause as Error);
      throw cause;
    }
  }, [action, splitId]);

  return {cancel, error: action.error, isPending: action.isPending, isSuccess: action.isSuccess};
}
