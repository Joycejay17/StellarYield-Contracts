import { useCallback, useEffect, useState } from "react";
import type { VaultState } from "@stellaryield/sdk";
import { config } from "../config";
import { describeError } from "../lib/errors";
import { readContract } from "../lib/soroban";
import { parseEnum } from "../lib/scval";

/** Row shown in the vault list — the minimum needed to pick a vault. */
export interface VaultSummary {
  address: string;
  name: string;
  symbol: string;
  state: VaultState;
  asset: string;
  assetDecimals: number;
  totalAssets: bigint;
  fundingTarget: bigint;
  expectedApy: number;
  rwaCategory: string;
  maturityDate: bigint;
}

interface VaultOverviewRaw {
  state: unknown;
  paused: boolean;
  asset: string;
  total_assets: bigint;
  total_supply: bigint;
  current_epoch: number;
  maturity_date: bigint;
}

interface RwaDetailsRaw {
  name: string;
  symbol: string;
  document_uri: string;
  category: string;
  expected_apy: number;
}

/**
 * Discover vaults through the factory registry (plus any pinned via
 * VITE_EXTRA_VAULTS) and load the summary each list row needs.
 */
export function useVaults() {
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const addresses = new Set<string>(config.extraVaults);

      if (config.factoryAddress) {
        const registered = await readContract<string[]>(
          config.factoryAddress,
          "get_single_rwa_vaults",
        );
        for (const addr of registered ?? []) addresses.add(addr);
      }

      // One vault failing to load must not blank the whole list.
      const results = await Promise.allSettled(
        [...addresses].map((address) => loadVaultSummary(address)),
      );

      setVaults(
        results
          .filter(
            (r): r is PromiseFulfilledResult<VaultSummary> => r.status === "fulfilled",
          )
          .map((r) => r.value),
      );

      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0 && failures === results.length) {
        setError("Could not read any vaults. Check the network and factory address.");
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { vaults, loading, error, reload: load };
}

async function loadVaultSummary(address: string): Promise<VaultSummary> {
  const [overview, rwa, name, symbol, fundingTarget] = await Promise.all([
    readContract<VaultOverviewRaw>(address, "get_vault_overview"),
    readContract<RwaDetailsRaw>(address, "get_rwa_details"),
    readContract<string>(address, "name"),
    readContract<string>(address, "symbol"),
    readContract<bigint>(address, "funding_target"),
  ]);

  const assetDecimals = await readContract<number>(overview.asset, "decimals");

  return {
    address,
    name,
    symbol,
    state: parseEnum<VaultState>(overview.state),
    asset: overview.asset,
    assetDecimals,
    totalAssets: overview.total_assets,
    fundingTarget,
    expectedApy: rwa.expected_apy,
    rwaCategory: rwa.category,
    maturityDate: overview.maturity_date,
  };
}
