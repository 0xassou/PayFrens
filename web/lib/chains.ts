import {base, baseSepolia} from "wagmi/chains";
import type {Address, Chain} from "viem";

export const BASE_ID = base.id; // 8453
export const BASE_SEPOLIA_ID = baseSepolia.id; // 84532

export type SupportedChainId = typeof BASE_ID | typeof BASE_SEPOLIA_ID;

/** Native, Circle-issued USDC. Not bridged USDbC. */
export const USDC_ADDRESS: Record<SupportedChainId, Address> = {
  [BASE_ID]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [BASE_SEPOLIA_ID]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

/**
 * Addresses of the deployments we ship against, recorded at deploy time.
 * See `contracts/deployments/` for the matching tx hashes and constructor args.
 *
 * Baked in rather than env-only so the app works from a plain `git clone` and
 * so a Vercel deploy needs no extra configuration to reach the live contract.
 */
const DEPLOYED_SPLITTER: Record<SupportedChainId, Address | undefined> = {
  // Not deployed to mainnet yet.
  [BASE_ID]: undefined,
  [BASE_SEPOLIA_ID]: "0x906a12f301B3D380ce0600d59b5F100FCf0DBE01",
};

/** Treats an unset *or* empty env var as absent, so a blank Vercel field falls back. */
function envAddress(value: string | undefined): Address | undefined {
  return value && value.length > 0 ? (value as Address) : undefined;
}

/**
 * Env wins over the baked-in address, so a preview deployment can point at a
 * different contract without a code change. See `web/.env.example`.
 */
export const SPLITTER_ADDRESS: Record<SupportedChainId, Address | undefined> = {
  [BASE_ID]: envAddress(process.env.NEXT_PUBLIC_SPLITTER_ADDRESS_BASE) ?? DEPLOYED_SPLITTER[BASE_ID],
  [BASE_SEPOLIA_ID]:
    envAddress(process.env.NEXT_PUBLIC_SPLITTER_ADDRESS_BASE_SEPOLIA) ??
    DEPLOYED_SPLITTER[BASE_SEPOLIA_ID],
};

export const CHAINS: Record<SupportedChainId, Chain> = {
  [BASE_ID]: base,
  [BASE_SEPOLIA_ID]: baseSepolia,
};

function isSupported(id: number): id is SupportedChainId {
  return id === BASE_ID || id === BASE_SEPOLIA_ID;
}

/** The chain this deployment targets. Defaults to Base Sepolia for safety. */
export const ACTIVE_CHAIN_ID: SupportedChainId = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  return isSupported(raw) ? raw : BASE_SEPOLIA_ID;
})();

export const ACTIVE_CHAIN = CHAINS[ACTIVE_CHAIN_ID];

export function usdcAddress(chainId: number = ACTIVE_CHAIN_ID): Address {
  if (!isSupported(chainId)) throw new Error(`No USDC address configured for chain ${chainId}`);
  return USDC_ADDRESS[chainId];
}

/**
 * Throws rather than returning undefined: every call site needs a real address,
 * and a missing one is a deploy-time misconfiguration worth surfacing loudly.
 */
export function splitterAddress(chainId: number = ACTIVE_CHAIN_ID): Address {
  if (!isSupported(chainId)) throw new Error(`Unsupported chain ${chainId}`);

  const address = SPLITTER_ADDRESS[chainId];
  if (!address) {
    throw new Error(
      `PayFrensSplitter address missing for chain ${chainId}. ` +
        `Set NEXT_PUBLIC_SPLITTER_ADDRESS_${chainId === BASE_ID ? "BASE" : "BASE_SEPOLIA"}.`,
    );
  }
  return address;
}

export function explorerTxUrl(hash: string, chainId: number = ACTIVE_CHAIN_ID): string {
  const chain = isSupported(chainId) ? CHAINS[chainId] : ACTIVE_CHAIN;
  return `${chain.blockExplorers?.default.url ?? "https://basescan.org"}/tx/${hash}`;
}
