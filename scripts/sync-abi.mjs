#!/usr/bin/env node
/**
 * Copies the PayFrensSplitter ABI out of the Foundry artifact into a checked-in
 * `as const` TypeScript literal.
 *
 * The literal is committed on purpose: viem infers argument and return types
 * from it, and the web build should not depend on contracts/ having been
 * compiled first.
 */
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = join(root, "contracts/out/PayFrensSplitter.sol/PayFrensSplitter.json");
const target = join(root, "web/lib/abi/payFrensSplitter.ts");

let parsed;
try {
  parsed = JSON.parse(readFileSync(artifact, "utf8"));
} catch {
  console.error(`Artifact not found at ${artifact}\nRun \`forge build\` in contracts/ first.`);
  process.exit(1);
}

const header = `// Generated from contracts/out/PayFrensSplitter.sol/PayFrensSplitter.json.
// Regenerate with: npm run abi:sync
//
// Kept as a checked-in \`as const\` literal rather than imported from the
// Foundry artifact so that viem can infer argument and return types, and so the
// web build never depends on contracts/ having been compiled.
export const payFrensSplitterAbi = `;

mkdirSync(dirname(target), {recursive: true});
writeFileSync(target, `${header}${JSON.stringify(parsed.abi, null, 2)} as const;\n`);

console.log(`Wrote ${parsed.abi.length} ABI entries to web/lib/abi/payFrensSplitter.ts`);
