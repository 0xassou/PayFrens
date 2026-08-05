# PayFrens contracts

Foundry workspace for `PayFrensSplitter`, the singleton split registry.

## Setup

`lib/` is gitignored, so install dependencies before your first build:

```bash
forge install foundry-rs/forge-std
forge build
forge test -vvv
```

## Layout

| Path                          | What it is                                        |
| ----------------------------- | ------------------------------------------------- |
| `src/PayFrensSplitter.sol`    | The registry contract — every split lives here    |
| `src/interfaces/IERC20.sol`   | Minimal ERC-20 interface                          |
| `src/libraries/SafeERC20.sol` | Transfer helper tolerant of non-standard ERC-20s  |
| `test/`                       | Foundry tests                                     |
| `script/Deploy.s.sol`         | Deploy script for Base and Base Sepolia           |

## Design notes

**One contract, many splits.** A split is a row in a mapping keyed by an
incrementing `uint256` id, not its own deployed contract. Creating a split costs
one storage write per participant instead of a full deployment, and every split
shares one USDC allowance — a participant who has already approved the registry
never approves again.

**USDC only.** The token address is immutable and set at deployment. There is no
path that moves any other token, and no path that moves ETH — the contract has
no `receive()`.

**The fee is charged once, at withdrawal.** `WITHDRAWAL_FEE_BPS = 50` (0.5%).
Participants transfer exactly their share; nothing is skimmed on the way in. The
fee is deducted when the creator pulls the money out, and goes to `treasury`.
`quoteWithdrawal()` returns the exact `(net, fee)` pair so the UI can show the
number before the user signs.

**Partial withdrawal is opt-in per split.** The creator chooses it via
`allowPartialWithdraw`, at creation or in a later edit. With it off (the default), `withdraw` reverts until
every participant has paid — the safe behaviour for a bill you intend to settle
in full. With it on, the creator can pull whatever has arrived so far, which
suits open-ended collections like a group gift where a straggler may never pay.
Either way the fee maths is identical and is applied to each withdrawal.

**Cancellation.** A creator can `cancel()` a split, but only before anyone has
paid into it — the moment `amountPaid` is nonzero, `cancel` reverts. This is the
escape hatch for a split that should never have been created, not a way to
unwind one that is already underway: once a single share has landed, the rest
of the group pays normally and there is no refund path back out.

**Editing shares that window.** `editSplit` (and `editEvenSplit`) rewrite a
split's title, roster, amounts and withdrawal policy under exactly the three
conditions that gate `cancel`: creator, still open, `amountPaid == 0`. One
window for both rules, rather than two to keep in sync — and with nothing paid
in there is no accounting to reconcile against the new shares.

The roster is replaced wholesale, not patched: pass the full list you want to
end up with. Anyone dropped from it stops being a participant on the spot and
can no longer pay. Two consequences worth knowing:

- `getSplit().revision` counts the edits. It exists because a rendering cached
  against a split — the OG share card above all — needs something that moves
  when the split changes, and editing is precisely the case where `paidCount`
  and `status` cannot.
- `splitsJoinedBy()` is append-only. Removing someone cannot take the id back
  out of their joined history, because splicing an unbounded array is unbounded
  gas, so a removed participant keeps a stale id in that list. Readers filter
  it by checking current membership — `getParticipant()` returns a zero share
  for anyone no longer in the split. Being kept across an edit, or removed and
  later added back, never duplicates the entry.

**Payers state what they expect.** Because a creator can raise a share right up
until the first payment lands — and clients approve USDC to this registry once,
unlimited, rather than per payment — an unguarded "pay whatever I owe" would
let an edit charge someone more than the screen they were looking at said. So
there is no such function. `payExact(splitId, expectedShare)` and
`payForExact(splitId, participant, expectedShare)` are the only ways in, and
both revert with `ShareChanged` unless the amount still matches. The guarantee
is a property of the contract, not of the client that happens to be calling it.

One consequence for error handling: the share check runs before the split is
looked up, so an outsider or a wrong id surfaces `ShareChanged` rather than
`NotParticipant` or `SplitDoesNotExist`. Those two are still reachable by
naming zero, which is what the tests do.

## Deployment

```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

`Deploy.s.sol` reads `TREASURY_ADDRESS` and picks the right USDC address from
the chain id it is broadcasting to.
