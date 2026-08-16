import { Networks } from "@stellar/stellar-sdk";

export type NetworkName = "testnet" | "futurenet" | "public" | "local";

const NETWORK_PASSPHRASES: Record<NetworkName, string> = {
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  public: Networks.PUBLIC,
  local: Networks.STANDALONE,
};

const DEFAULT_RPC: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
  public: "https://mainnet.sorobanrpc.com",
  local: "http://localhost:8000/soroban/rpc",
};

const network = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as NetworkName;

if (!(network in NETWORK_PASSPHRASES)) {
  throw new Error(
    `Unknown VITE_STELLAR_NETWORK "${network}". Expected one of: ${Object.keys(
      NETWORK_PASSPHRASES,
    ).join(", ")}`,
  );
}

/** Vault contract IDs pinned via env, shown alongside the factory registry. */
const extraVaults = (import.meta.env.VITE_EXTRA_VAULTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  network,
  networkPassphrase: NETWORK_PASSPHRASES[network],
  rpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL || DEFAULT_RPC[network],
  factoryAddress: (import.meta.env.VITE_FACTORY_ADDRESS ?? "").trim(),
  extraVaults,
};

/** True when the app has enough configuration to talk to a deployment. */
export const isConfigured = Boolean(config.factoryAddress) || extraVaults.length > 0;
