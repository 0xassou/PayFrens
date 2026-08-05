/**
 * Turns a wallet/contract failure into something a user can act on.
 *
 * The previous version of this collapsed everything it did not recognise into
 * "please try again", which hid the most common desktop failure of all: the
 * wallet was never connected, so `writeContract` threw
 * `ConnectorNotConnectedError` before a transaction was ever built. "Try again"
 * is the one thing that cannot fix that.
 *
 * Ordering matters. Wallet-level problems are checked before contract reverts,
 * because a viem error message embeds the whole request and a naive substring
 * match against the calldata dump produces confident nonsense.
 */
export function friendlyError(error: Error, fallback = "Something went wrong. Please try again."): string {
  // viem hangs the useful summary off `shortMessage`; `name` carries the class.
  const short = (error as {shortMessage?: string}).shortMessage ?? "";
  const name = error.name ?? "";
  const text = `${name} ${short} ${error.message ?? ""}`;

  // --- Wallet and network, before anything touches the contract -------------

  if (/ConnectorNotConnected|not connected|No connector/i.test(text)) {
    return "Connect your wallet first.";
  }
  if (/User rejected|UserRejected|denied|rejected the request/i.test(text)) {
    return "Cancelled in your wallet.";
  }
  if (/ChainMismatch|chain .*does not match|Chain not configured|SwitchChain/i.test(text)) {
    return "Wrong network — switch your wallet to Base Sepolia.";
  }
  if (/insufficient funds for gas|insufficient funds for intrinsic/i.test(text)) {
    return "Not enough ETH to cover gas.";
  }

  // --- Contract reverts -----------------------------------------------------

  if (/DuplicateParticipant/i.test(text)) return "Someone is in the list twice.";
  if (/TooManyParticipants/i.test(text)) return "That's more than 100 people.";
  if (/NoParticipants/i.test(text)) return "Add at least one person.";
  if (/TitleTooLong/i.test(text)) return "That title is too long.";
  if (/TotalTooLarge/i.test(text)) return "That amount is too large.";
  if (/ZeroShare/i.test(text)) return "Everyone needs a share above zero.";
  if (/LengthMismatch/i.test(text)) return "Participants and shares don't line up.";
  if (/AlreadyPaid/i.test(text)) return "That share is already paid.";
  if (/PaymentsAlreadyStarted/i.test(text)) {
    return "Someone already paid — this split can't be changed now.";
  }
  // The creator edited the split between this screen loading and the payment
  // landing. Saying "refresh" is the whole fix, and it is the honest reason.
  if (/ShareChanged/i.test(text)) {
    return "This split changed just now — refresh to see what you owe.";
  }
  if (/NotFullyPaid/i.test(text)) return "Not everyone has paid yet.";
  if (/NotParticipant/i.test(text)) return "You're not part of this split.";
  if (/NotCreator/i.test(text)) return "Only the person who created this split can do that.";
  if (/SplitNotOpen/i.test(text)) return "This split is closed.";
  if (/NothingToWithdraw/i.test(text)) return "There's nothing to withdraw yet.";

  // ERC-20 balance and allowance, which read as generic "insufficient" strings.
  if (/transfer amount exceeds balance|insufficient balance/i.test(text)) {
    return "Not enough USDC in your wallet.";
  }
  if (/allowance|insufficient allowance/i.test(text)) {
    return "Approve USDC spending first.";
  }

  // --- Transport ------------------------------------------------------------

  if (/HttpRequestError|fetch failed|Failed to fetch|timed out|TimeoutError/i.test(text)) {
    return "Network problem reaching Base. Check your connection and retry.";
  }
  if (/missing address|PayFrensSplitter address missing/i.test(text)) {
    return "This app isn't configured for the current network.";
  }

  return fallback;
}

/**
 * Logs the underlying error so a real cause is one console open away, rather
 * than lost behind whatever copy we chose to show.
 */
export function reportError(context: string, error: Error): void {
  const short = (error as {shortMessage?: string}).shortMessage;
  console.error(`[PayFrens] ${context}:`, short ?? error.message, error);
}
