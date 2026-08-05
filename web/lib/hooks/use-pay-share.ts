"use client";

import {useCallback, useMemo, useState} from "react";
import {maxUint256} from "viem";
import {
  useAccount,
  useCapabilities,
  useSendCalls,
  useWaitForCallsStatus,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {erc20Abi} from "@/lib/abi/erc20";
import {payFrensSplitterAbi} from "@/lib/abi/payFrensSplitter";
import {ACTIVE_CHAIN_ID, splitterAddress, usdcAddress} from "@/lib/chains";
import {useUsdcAllowance} from "./use-splits";

export type PayStep = "idle" | "approving" | "paying" | "confirming" | "done" | "error";

/**
 * "Pay my share" in one tap.
 *
 * ERC-20 payment is really two calls — approve, then pay — which is two wallet
 * prompts and two waits. Base App's wallet supports EIP-5792 batching, so when
 * it is available both calls go out as a single atomic bundle and the user taps
 * once. Wallets without it fall back to the sequential path, which still works,
 * just with two prompts.
 *
 * We approve `maxUint256` rather than the exact share: the allowance is granted
 * to the registry, which every split shares, so approving once means every
 * future split really is one tap.
 *
 * That standing allowance is why this calls `payExact` and not `pay`. A split's
 * creator can rewrite its shares until the first payment lands, so between the
 * moment this screen read the share and the moment the transaction executes,
 * the amount owed can change — and an unlimited approval would not stop the
 * larger charge. `payExact` names the amount on screen and reverts if the chain
 * disagrees, so the user is never charged something they did not see.
 */
export function usePayShare(splitId: bigint | undefined, share: bigint | undefined) {
  const {address} = useAccount();
  const [step, setStep] = useState<PayStep>("idle");
  const [error, setError] = useState<Error | null>(null);

  const {data: allowance, refetch: refetchAllowance} = useUsdcAllowance(address);
  const {data: capabilities} = useCapabilities({account: address, query: {enabled: Boolean(address)}});

  const needsApproval = useMemo(() => {
    if (share === undefined) return false;
    return (allowance ?? 0n) < share;
  }, [allowance, share]);

  const supportsBatching = useMemo(() => {
    const chainCapabilities = capabilities?.[ACTIVE_CHAIN_ID];
    const atomic = (chainCapabilities as {atomic?: {status?: string}} | undefined)?.atomic?.status;
    return atomic === "supported" || atomic === "ready";
  }, [capabilities]);

  const {sendCallsAsync} = useSendCalls();
  const {writeContractAsync} = useWriteContract();

  const [callsId, setCallsId] = useState<string | undefined>();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const callsStatus = useWaitForCallsStatus({id: callsId, query: {enabled: Boolean(callsId)}});
  const receipt = useWaitForTransactionReceipt({hash: txHash, query: {enabled: Boolean(txHash)}});

  const pay = useCallback(async () => {
    if (splitId === undefined || share === undefined) return;

    setError(null);

    const spender = splitterAddress();
    const token = usdcAddress();

    const approveCall = {
      to: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, maxUint256],
    } as const;

    const payCall = {
      to: spender,
      abi: payFrensSplitterAbi,
      functionName: "payExact",
      args: [splitId, share],
    } as const;

    try {
      if (supportsBatching) {
        setStep("paying");
        const result = await sendCallsAsync({
          calls: needsApproval ? [approveCall, payCall] : [payCall],
        });
        setCallsId(result.id);
        setStep("confirming");
        return;
      }

      // Sequential fallback: approve first and wait for it to land, because the
      // pay call reverts if the allowance is not already on chain.
      if (needsApproval) {
        setStep("approving");
        await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, maxUint256],
          chainId: ACTIVE_CHAIN_ID,
        });
        await refetchAllowance();
      }

      setStep("paying");
      const hash = await writeContractAsync({
        address: spender,
        abi: payFrensSplitterAbi,
        functionName: "payExact",
        args: [splitId, share],
        chainId: ACTIVE_CHAIN_ID,
      });
      setTxHash(hash);
      setStep("confirming");
    } catch (cause) {
      setError(cause as Error);
      setStep("error");
    }
  }, [
    needsApproval,
    refetchAllowance,
    sendCallsAsync,
    share,
    splitId,
    supportsBatching,
    writeContractAsync,
  ]);

  const settled = callsStatus.data?.status === "success" || receipt.data?.status === "success";
  const reverted = callsStatus.data?.status === "failure" || receipt.data?.status === "reverted";

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setCallsId(undefined);
    setTxHash(undefined);
  }, []);

  return {
    pay,
    reset,
    step: reverted ? ("error" as PayStep) : settled ? ("done" as PayStep) : step,
    error,
    /** True while anything is in flight — drives the button's loading state. */
    isPending: step === "approving" || step === "paying" || step === "confirming",
    isSuccess: settled,
    needsApproval,
    /** Whether this wallet can do it in a single tap. Surfaced in the UI copy. */
    isOneTap: supportsBatching,
    txHash,
  };
}
