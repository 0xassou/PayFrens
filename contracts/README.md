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

**Partial withdrawal is opt-in per split.** The creator chooses at creation time
via `allowPartialWithdraw`. With it off (the default), `withdraw` reverts until
every participant has paid — the safe behaviour for a bill you intend to settle
in full. With it on, the creator can pull whatever has arrived so far, which
suits open-ended collections like a group gift where a straggler may never pay.
Either way the fee maths is identical and is applied to each withdrawal.

**Refunds.** A creator can `cancel()` a split that has not been withdrawn from.
Cancelling stops further payments and lets each participant who already paid
call `claimRefund()` to take their money back, in full, with no fee. This is the
escape hatch for a split that will never complete.

## Deployment

```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

`Deploy.s.sol` reads `TREASURY_ADDRESS` and picks the right USDC address from
the chain id it is broadcasting to.
