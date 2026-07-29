import { query } from "../db/index.js";
import { logger } from "../logger.js";

export interface VaultAnnualReportData {
  year: number;
  totalYieldDistributed: string;
  epochCount: number;
  averageYieldPerEpoch: string;
  startTotalAssets: string;
  endTotalAssets: string;
  netAssetGrowth: string;
}

export async function computeAnnualReportData(vaultId: number, year: number): Promise<VaultAnnualReportData> {
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Aggregate epoch data for the requested year
  const epochRows = await query<{ epoch_count: string; total_yield: string }>(
    `SELECT COUNT(*)::text AS epoch_count,
            COALESCE(SUM(yield_amount::numeric), 0)::text AS total_yield
     FROM epochs
     WHERE vault_id = $1
       AND distributed_at >= $2
       AND distributed_at < $3`,
    [vaultId, yearStart, yearEnd],
  );

  const epochCount = parseInt(epochRows[0]?.epoch_count ?? "0", 10);
  const totalYieldDistributed = epochRows[0]?.total_yield ?? "0";
  const totalYieldBig = BigInt(Math.round(parseFloat(totalYieldDistributed)));
  const averageYieldPerEpoch = epochCount > 0
    ? (totalYieldBig / BigInt(epochCount)).toString()
    : "0";

  // Nearest snapshot at or after year start (startTotalAssets)
  const startSnapshotRows = await query<{ total_assets: string }>(
    `SELECT total_assets::text
     FROM vault_tvl_snapshots
     WHERE vault_id = $1 AND recorded_at >= $2
     ORDER BY recorded_at ASC
     LIMIT 1`,
    [vaultId, yearStart],
  );

  // Nearest snapshot at or before year end (endTotalAssets)
  const endSnapshotRows = await query<{ total_assets: string }>(
    `SELECT total_assets::text
     FROM vault_tvl_snapshots
     WHERE vault_id = $1 AND recorded_at < $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [vaultId, yearEnd],
  );

  const startTotalAssets = startSnapshotRows[0]?.total_assets ?? "0";
  const endTotalAssets = endSnapshotRows[0]?.total_assets ?? "0";

  const startBig = BigInt(Math.round(parseFloat(startTotalAssets)));
  const endBig = BigInt(Math.round(parseFloat(endTotalAssets)));
  const netAssetGrowth = (endBig - startBig).toString();

  return {
    year,
    totalYieldDistributed: totalYieldBig.toString(),
    epochCount,
    averageYieldPerEpoch,
    startTotalAssets: startBig.toString(),
    endTotalAssets: endBig.toString(),
    netAssetGrowth,
  };
}

export async function generateVaultReports(year?: number): Promise<void> {
  const targetYear = year ?? new Date().getUTCFullYear();
  logger.info({ year: targetYear }, "Pre-generating vault annual reports via pg-boss cron");

  const vaults = await query<{ id: number; contract_id: string }>(
    "SELECT id, contract_id FROM vaults WHERE archived = FALSE OR archived IS NULL",
  );

  for (const vault of vaults) {
    try {
      const reportData = await computeAnnualReportData(vault.id, targetYear);
      await query(
        `INSERT INTO cached_reports (vault_id, report_type, report_year, data, generated_at)
         VALUES ($1, 'annual', $2, $3, NOW())
         ON CONFLICT (vault_id, report_type, report_year)
         DO UPDATE SET data = EXCLUDED.data, generated_at = NOW()`,
        [vault.id, targetYear, JSON.stringify(reportData)],
      );
      logger.info({ vaultId: vault.id, contractId: vault.contract_id, year: targetYear }, "Cached annual report");
    } catch (err) {
      logger.error({ err, vaultId: vault.id, year: targetYear }, "Failed to generate cached annual report");
    }
  }
}
