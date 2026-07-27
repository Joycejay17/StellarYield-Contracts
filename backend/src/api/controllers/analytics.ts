import type { Request, Response, NextFunction } from "express";
import { query } from "../../db/index.js";
import { cacheGet, cacheSet } from "../../cache/redis.js";
import type { AnalyticsSummary, TvlAggregate } from "../../types/index.js";

const ANALYTICS_CACHE_TTL = 60;
const TVL_CACHE_CONTROL = "max-age=30";

export async function getAnalyticsSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const cached = await cacheGet<AnalyticsSummary>("analytics:summary");
    if (cached) {
      res.json(cached);
      return;
    }

    const [vaultCountRows, userCountRows, tvlRows, yieldRows, depositorRows] =
      await Promise.all([
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM vaults"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users"),
        query<{ total: string }>(
          "SELECT COALESCE(SUM(total_assets::numeric), 0)::text AS total FROM vaults",
        ),
        query<{ total: string }>(
          "SELECT COALESCE(SUM(yield_amount::numeric), 0)::text AS total FROM epochs",
        ),
        query<{ count: string }>(
          `SELECT COUNT(DISTINCT user_address)::text AS count
           FROM user_vault_positions
           WHERE shares > 0`,
        ),
      ]);

    const summary: AnalyticsSummary = {
      totalUsers: parseInt(userCountRows[0]?.count ?? "0", 10),
      totalVaults: parseInt(vaultCountRows[0]?.count ?? "0", 10),
      totalValueLocked: tvlRows[0]?.total ?? "0",
      totalYieldDistributed: yieldRows[0]?.total ?? "0",
      totalDepositors: parseInt(depositorRows[0]?.count ?? "0", 10),
    };

    await cacheSet("analytics:summary", summary, ANALYTICS_CACHE_TTL);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

/**
 * Public cross-vault TVL aggregate (#775). Unlike /api/v1/admin/stats this
 * requires no authentication, so platform dashboards can render total TVL
 * without an API key.
 */
export async function getTvlAggregate(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await query<{
      total_value_locked: string;
      active_vault_count: string;
      funding_vault_count: string;
    }>(
      `SELECT
         COALESCE(SUM(total_assets::numeric), 0)::text AS total_value_locked,
         COUNT(*) FILTER (WHERE state = 'Active')::text AS active_vault_count,
         COUNT(*) FILTER (WHERE state = 'Funding')::text AS funding_vault_count
       FROM vaults
       WHERE archived = FALSE`,
    );

    const row = rows[0];
    const tvl: TvlAggregate = {
      totalValueLocked: row?.total_value_locked ?? "0",
      activeVaultCount: parseInt(row?.active_vault_count ?? "0", 10),
      fundingVaultCount: parseInt(row?.funding_vault_count ?? "0", 10),
    };

    res.set("Cache-Control", TVL_CACHE_CONTROL);
    res.json(tvl);
  } catch (err) {
    next(err);
  }
}
