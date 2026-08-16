/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: string;
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_FACTORY_ADDRESS?: string;
  readonly VITE_EXTRA_VAULTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
