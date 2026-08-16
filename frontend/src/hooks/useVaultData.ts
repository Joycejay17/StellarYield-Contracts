import { useCallback, useEffect, useState } from "react";
import type { VaultState } from "@stellaryield/sdk";
import { Address } from "@stellar/stellar-sdk";
import { describeError } from "../lib/errors";
import { readContract } from "../lib/soroban";
import { parseEnum } from "../lib/scval";

export interface VaultData {
  address: string;
  name: string;
  symbol: string;
  state: VaultState;
  paused: boolean;

  asset: string;
  assetSymbol: string;
  assetDecimals: number;
  shareDecimals: number;

  totalAssets: bigint;
  totalSupply: bigint;
  sharePrice: bigint;
  currentEpoch: number;

  fundingTarget: bigint;
  fundingProgressBps: number;
  maturityDate: bigint;
  timeToMaturity: bigint;

  minDeposit: bigint;
  maxDepositPerUser: bigint;
  earlyRedemptionFeeBps: number;
  totalYieldDistributed: bigint;

  rwaName: string;
  rwaSymbol: string;
  rwaCategory: string;
  rwaDocumentUri: string;
  expectedApy: number;
}

export interface UserData {
  shareBalance: bigint;
  pendingYield: bigint;
  totalDeposited: bigint;
  isBlacklisted: boolean;
  isKycVerified: boolean;
  assetBalance: bigint;
  /** True when the account holds no trustline for the vault's asset. */
  assetTrustlineMissing: boolean;
  isOperator: boolean;
  maxDeposit: bigint;
}

const addr = (a: string) => Address.fromString(a).toScVal();

/**
 * Load everything the vault detail screen displays, for the vault and (when a
 * wallet is connected) for the connected account.
 */
export function useVaultData(vaultAddress: string, walletAddress: string | null) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const vaultData = await loadVault(vaultAddress);
      setVault(vaultData);
      setUser(
        walletAddress
          ? await loadUser(vaultAddress, vaultData.asset, walletAddress)
          : null,
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [vaultAddress, walletAddress]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { vault, user, loading, error, refresh: load };
}

async function loadVault(address: string): Promise<VaultData> {
  const [
    overview,
    earlyRedemptionFeeBps,
    minDeposit,
    maxDepositPerUser,
    rwa,
    name,
    symbol,
    shareDecimals,
    fundingTarget,
    fundingProgressBps,
    timeToMaturity,
    totalYieldDistributed,
  ] = await Promise.all([
    readContract<{
      state: unknown;
      paused: boolean;
      asset: string;
      total_assets: bigint;
      total_supply: bigint;
      current_epoch: number;
      maturity_date: bigint;
    }>(address, "get_vault_overview"),
    // Read these individually rather than via `get_config_snapshot`: that
    // consolidated view is not present on every branch, while these three
    // getters are stable across all of them.
    readContract<number>(address, "early_redemption_fee_bps"),
    readContract<bigint>(address, "min_deposit"),
    readContract<bigint>(address, "max_deposit_per_user"),
    readContract<{
      name: string;
      symbol: string;
      document_uri: string;
      category: string;
      expected_apy: number;
    }>(address, "get_rwa_details"),
    readContract<string>(address, "name"),
    readContract<string>(address, "symbol"),
    readContract<number>(address, "decimals"),
    readContract<bigint>(address, "funding_target"),
    readContract<number>(address, "funding_progress_bps"),
    readContract<bigint>(address, "time_to_maturity"),
    readContract<bigint>(address, "total_yield_distributed"),
  ]);

  const [assetDecimals, assetSymbol, sharePrice] = await Promise.all([
    readContract<number>(overview.asset, "decimals"),
    readContract<string>(overview.asset, "symbol"),
    readContract<bigint>(address, "share_price"),
  ]);

  return {
    address,
    name,
    symbol,
    state: parseEnum<VaultState>(overview.state),
    paused: overview.paused,
    asset: overview.asset,
    assetSymbol,
    assetDecimals,
    shareDecimals,
    totalAssets: overview.total_assets,
    totalSupply: overview.total_supply,
    sharePrice,
    currentEpoch: overview.current_epoch,
    fundingTarget,
    fundingProgressBps,
    maturityDate: overview.maturity_date,
    timeToMaturity,
    minDeposit,
    maxDepositPerUser,
    earlyRedemptionFeeBps,
    totalYieldDistributed,
    rwaName: rwa.name,
    rwaSymbol: rwa.symbol,
    rwaCategory: rwa.category,
    rwaDocumentUri: rwa.document_uri,
    expectedApy: rwa.expected_apy,
  };
}

async function loadUser(
  vaultAddress: string,
  assetAddress: string,
  wallet: string,
): Promise<UserData> {
  const [overview, assetBalanceResult, isOperator, maxDeposit] = await Promise.all([
    readContract<{
      share_balance: bigint;
      pending_yield: bigint;
      total_deposited: bigint;
      is_blacklisted: boolean;
      is_kyc_verified: boolean;
    }>(vaultAddress, "get_user_overview", [addr(wallet)]),
    // A Stellar Asset Contract settles G-addresses through classic trustlines
    // and panics when one is missing. That is an expected state for a new
    // account, so it must not fail the whole page load.
    readContract<bigint>(assetAddress, "balance", [addr(wallet)]).then(
      (value) => ({ value, trustlineMissing: false }),
      () => ({ value: 0n, trustlineMissing: true }),
    ),
    readContract<boolean>(vaultAddress, "is_operator", [addr(wallet)]),
    readContract<bigint>(vaultAddress, "max_deposit", [addr(wallet)]),
  ]);

  return {
    shareBalance: overview.share_balance,
    pendingYield: overview.pending_yield,
    totalDeposited: overview.total_deposited,
    isBlacklisted: overview.is_blacklisted,
    isKycVerified: overview.is_kyc_verified,
    assetBalance: assetBalanceResult.value,
    assetTrustlineMissing: assetBalanceResult.trustlineMissing,
    isOperator,
    maxDeposit,
  };
}
