# PayFrens

Split bills in USDC on Base — a mini-app for Base App.

One person creates a **split** (a restaurant bill, a group gift, rent, a
subscription). Everybody who's in it pays their share in one tap. Once the
whole thing is funded, the creator withdraws the total.

## How it works

1. **Create** — pick a title, add participants, choose an even split or set a
   custom amount per person.
2. **Share** — the split URL unfurls as an interactive card in Farcaster / Base
   App feeds, with a live `X/Y paid` progress image.
3. **Fix it if it's wrong** — until the first payment lands, the creator can
   edit the title, the amounts and who's in it, or cancel the split outright.
   The link keeps working: an edit rewrites the split in place rather than
   making a new one. Once someone has paid, both close.
4. **Pay** — participants approve USDC once and tap *Pay my share*. The app
   names the amount on chain, so an edit can never charge someone more than the
   figure they tapped.
5. **Withdraw** — when everyone has paid, the creator withdraws. A 0.5% protocol
   fee is taken **at withdrawal only**, and is shown in the UI before the user
   confirms.

Participants never pay a protocol fee. The person who collects the money does.

## Repository layout

```
PayFrens/
├── contracts/          Foundry workspace — Solidity, tests, deploy scripts
│   ├── src/            PayFrensSplitter.sol (singleton registry)
│   ├── test/           Foundry tests
│   └── script/         Deploy scripts (Base + Base Sepolia)
└── web/                Next.js App Router mini-app
    ├── app/            Routes, dynamic OG images, .well-known manifest
    ├── components/     UI
    └── lib/            Contract bindings, chain config, helpers
```

## Networks

| Network      | Chain ID | USDC                                         |
| ------------ | -------- | -------------------------------------------- |
| Base         | 8453     | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532    | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Getting started

```bash
# contracts
cd contracts
forge install          # pulls forge-std
forge build
forge test -vvv

# web
cd web
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Stack

- **Next.js** (App Router) + TypeScript
- **MiniKit** (`@coinbase/onchainkit/minikit`) — wallet, social context, push
  notifications inside Base App
- **wagmi / viem** — onchain reads and writes
- **Tailwind CSS** — every colour comes from a semantic design token, so light
  and dark mode share one source of truth
- **Foundry** — Solidity toolchain, targeting Base

## Licence

MIT
