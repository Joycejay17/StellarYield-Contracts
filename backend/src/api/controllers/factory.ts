import type { Request, Response, NextFunction } from "express";
import { query } from "../../db/index.js";

interface VaultTypeDistributionEntry {
  vaultType: string;
  count: number;
  percentage: number;
}

/**
 * Distribution of deployed vaults by type (rwa_category), so clients can
 * show what proportion of the factory's vaults fall into each category (#843).
 * Categories with no vaults are omitted rather than shown at 0%.
 */
export async function getVaultTypeDistribution(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await query<{ vault_type: string; count: string }>(
      `SELECT rwa_category AS vault_type, COUNT(*)::text AS count
       FROM vaults
       WHERE archived = FALSE AND rwa_category IS NOT NULL
       GROUP BY rwa_category
       ORDER BY count DESC`,
    );

    const total = rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

    const distribution: VaultTypeDistributionEntry[] = total === 0
      ? []
      : rows.map((row) => {
          const count = parseInt(row.count, 10);
          return {
            vaultType: row.vault_type,
            count,
            percentage: (count / total) * 100,
          };
        });

    res.json(distribution);
  } catch (err) {
    next(err);
  }
}
