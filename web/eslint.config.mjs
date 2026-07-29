import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so they spread in directly —
 * no FlatCompat bridge.
 */
const config = [
  {ignores: [".next/**", "node_modules/**", "lib/abi/**"]},
  ...coreWebVitals,
  ...typescript,
];

export default config;
