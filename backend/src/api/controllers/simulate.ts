import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import {
  readTotalAssets,
  readFundingTarget,
  readShareBalance,
  readTotalSupply,
} from "../../services/stellar.js";
import { query } from "../../db/index.js";
import { cacheGet, cacheSet } from "../../cache/redis.js";
import { translateErrorCode } from "../../stellar/error-codes.js";
import { logger } from "../../logger.js";

const contractAddressSchema = z.string().length(56).regex(/^C[A-Z2-7]{55}$/);

// ── Issue #1014: Simulation result caching ───────────────────────────────────

const SIMULATION_CACHE_TTL_SECONDS = 5;

/**
 * Generate a deterministic cache key for simulation results.
 * Key format: `sim:{contractId}:{operation}:{hash(params)}`
 */
function simulationCacheKey(contractId: string, operation: string, params: unknown): string {
  const paramsHash = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 16);
  return `sim:${contractId}:${operation}:${paramsHash}`;
}

// ── Issue #1017: Simulation audit logging ─────────────────────────────────────

interface SimulationAuditLog {
  contractId: string;
  operation: string;
  params: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  fromCache: boolean;
}

async function logSimulation(result: SimulationAuditLog): Promise<void> {
  const logData: Record<string, unknown> = {
    contractId: result.contractId,
    operation: result.operation,
    params: result.params,
    durationMs: result.durationMs,
    fromCache: result.fromCache,
  };

  if (logger.level === "debug") {
    logData.result = result.result;
  }

  logger.debug(logData, "Simulation request");
}

// ── Issue #1015: Simulation error translation ────────────────────────────────

const translateErrorBodySchema = z.object({
  errorCode: z.number().int(),
});

/**
 * POST /api/v1/vaults/simulate/translate-error
 *
 * Translates an opaque XDR-encoded Soroban error code into a human-readable
 * description. Issue #1015.
 */
export async function translateSimulationError(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = translateErrorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "BadRequest",
        message: "errorCode is required and must be an integer",
      });
      return;
    }

    const translation = translateErrorCode(parsed.data.errorCode);
    res.json(translation);
  } catch (err) {
    next(err);
  }
}

// ── Issue #1012: Funding progress simulation ─────────────────────────────────

/**
 * GET /api/v1/vaults/:contractId/simulate/funding
 *
 * Returns funding progress for a vault in the Funding phase:
 *   { currentAssets, fundingTarget, remaining, progressPercent,
 *     additionalDepositsNeeded }
 *
 * `additionalDepositsNeeded` = Math.ceil(remaining / avgDepositAmount) using
 * the average of the last 10 deposits. Issue #1012.
 */
export async function simulateFundingProgress(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startTime = Date.now();
  try {
    const parsed = contractAddressSchema.safeParse(req.params["contractId"]);
    if (!parsed.success) {
      res.status(400).json({ error: "BadRequest", message: "Invalid contractId format" });
      return;
    }
    const contractId = parsed.data;

    // Issue #1014: Check cache first
    const cacheKey = simulationCacheKey(contractId, "funding", {});
    const cached = await cacheGet<{
      currentAssets: string;
      fundingTarget: string;
      remaining: string;
      progressPercent: number;
      additionalDepositsNeeded: number;
    }>(cacheKey);
    
    const fromCache = !!cached;
    if (cached) {
      await logSimulation({
        contractId,
        operation: "funding_progress",
        params: {},
        result: cached,
        durationMs: Date.now() - startTime,
        fromCache,
      });
      res.json(cached);
      return;
    }

    // Check vault exists in DB
    const vaultRows = await query<{ id: number }>(
      "SELECT id FROM vaults WHERE contract_id = $1",
      [contractId],
    );
    if (vaultRows.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Vault not found" });
      return;
    }

    const [currentAssets, fundingTarget] = await Promise.all([
      readTotalAssets(contractId).catch(() => 0n),
      readFundingTarget(contractId).catch(() => 0n),
    ]);

    const currentAssetsBigInt = BigInt(currentAssets);
    const fundingTargetBigInt = BigInt(fundingTarget);

    // Already fully funded or no target set
    const remaining = fundingTargetBigInt > 0n
      ? fundingTargetBigInt - currentAssetsBigInt > 0n
        ? fundingTargetBigInt - currentAssetsBigInt
        : 0n
      : 0n;

    const progressPercent = fundingTargetBigInt > 0n
      ? currentAssetsBigInt >= fundingTargetBigInt
        ? 100
        : Math.round(
            (Number(currentAssetsBigInt * 10000n) / Number(fundingTargetBigInt)) * 100,
          ) / 100
      : 0;

    // Calculate average deposit from the last 10 deposits
    const avgDepositRows = await query<{ avg_amount: string }>(
      `SELECT AVG(amount)::text AS avg_amount
       FROM (
         SELECT (ie.payload #>> '{value,vec,0,i128,lo}')::numeric AS amount
         FROM indexed_events ie
         WHERE ie.contract_id = $1
           AND ie.event_type = 'deposit'
         ORDER BY ie.created_at DESC
         LIMIT 10
       ) recent_deposits`,
      [contractId],
    );

    const avgDepositAmount = parseFloat(avgDepositRows[0]?.avg_amount ?? "0");
    const additionalDepositsNeeded =
      remaining > 0n && avgDepositAmount > 0
        ? Math.ceil(Number(remaining) / avgDepositAmount)
        : 0;

    const result = {
      currentAssets: currentAssetsBigInt.toString(),
      fundingTarget: fundingTargetBigInt.toString(),
      remaining: remaining.toString(),
      progressPercent,
      additionalDepositsNeeded,
    };

    // Issue #1014: Cache result for 5 seconds
    await cacheSet(cacheKey, result, SIMULATION_CACHE_TTL_SECONDS);

    await logSimulation({
      contractId,
      operation: "funding_progress",
      params: {},
      result,
      durationMs: Date.now() - startTime,
      fromCache: false,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── Issue #1013: Multi-operation simulation ──────────────────────────────────

interface SimulationResult {
  operationType: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

const operationSchema = z.object({
  type: z.enum(["deposit", "withdraw", "claim"]),
  params: z.record(z.unknown()).default({}),
});

const multiOperationBodySchema = z.object({
  operations: z.array(operationSchema).min(1).max(10),
});

/**
 * POST /api/v1/vaults/:contractId/simulate
 *
 * Simulates multiple operations sequentially, passing the resulting vault state
 * to the next operation. Returns an array of results, one per operation.
 * Issue #1013.
 */
export async function simulateMultiOperation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startTime = Date.now();
  try {
    const parsed = contractAddressSchema.safeParse(req.params["contractId"]);
    if (!parsed.success) {
      res.status(400).json({ error: "BadRequest", message: "Invalid contractId format" });
      return;
    }
    const contractId = parsed.data;

    const bodyParsed = multiOperationBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: "BadRequest",
        issues: bodyParsed.error.issues,
      });
      return;
    }

    const { operations } = bodyParsed.data;

    // Issue #1014: Check cache first
    const cacheKey = simulationCacheKey(contractId, "multi", operations);
    const cached = await cacheGet<SimulationResult[]>(cacheKey);
    
    const fromCache = !!cached;
    if (cached) {
      await logSimulation({
        contractId,
        operation: "multi_operation",
        params: { operations },
        result: cached,
        durationMs: Date.now() - startTime,
        fromCache,
      });
      res.json(cached);
      return;
    }

    // Verify vault exists
    const vaultRows = await query<{ id: number; state: string; total_assets: string; total_supply: string }>(
      "SELECT id, state, total_assets, total_supply FROM vaults WHERE contract_id = $1",
      [contractId],
    );
    if (vaultRows.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Vault not found" });
      return;
    }

    const vault = vaultRows[0];
    let currentAssets = BigInt(vault.total_assets);
    let currentSupply = BigInt(vault.total_supply);
    let vaultState = vault.state;

    const results: SimulationResult[] = [];

    for (const op of operations) {
      try {
        // Check vault state before each operation
        if (vaultState === "Cancelled" || vaultState === "Closed") {
          results.push({
            operationType: op.type,
            success: false,
            error: `Vault is in ${vaultState} state. No operations are allowed.`,
          });
          continue;
        }

        if (op.type === "deposit") {
          if (vaultState === "Matured") {
            results.push({
              operationType: op.type,
              success: false,
              error: "Vault has matured. No new deposits are accepted.",
            });
            continue;
          }

          const amount = BigInt(String(op.params["amount"] ?? "0"));
          if (amount <= 0n) {
            results.push({
              operationType: op.type,
              success: false,
              error: "Deposit amount must be a positive integer.",
            });
            continue;
          }

          // Simulate the deposit: newAssets = currentAssets + amount
          const newAssets = currentAssets + amount;
          // shares issued = amount * totalSupply / totalAssets (or = amount if first deposit)
          const sharesIssued = currentSupply > 0n
            ? (amount * currentSupply) / currentAssets
            : amount;

          results.push({
            operationType: op.type,
            success: true,
            result: {
              depositedAssets: amount.toString(),
              sharesIssued: sharesIssued.toString(),
              newTotalAssets: newAssets.toString(),
              newTotalSupply: (currentSupply + sharesIssued).toString(),
            },
          });

          // Update simulated state for next operation
          currentAssets = newAssets;
          currentSupply = currentSupply + sharesIssued;

          // If funding target reached, transition state
          try {
            const ft = await readFundingTarget(contractId);
            if (vaultState === "Funding" && currentAssets >= ft && ft > 0n) {
              vaultState = "Active";
            }
          } catch {
            // funding target not available
          }
        } else if (op.type === "withdraw") {
          if (vaultState === "Funding") {
            results.push({
              operationType: op.type,
              success: false,
              error: "Vault is in Funding state. Withdrawals are only available in Active state.",
            });
            continue;
          }

          const shares = BigInt(String(op.params["shares"] ?? "0"));
          if (shares <= 0n) {
            results.push({
              operationType: op.type,
              success: false,
              error: "Shares amount must be a positive integer.",
            });
            continue;
          }

          if (shares > currentSupply) {
            results.push({
              operationType: op.type,
              success: false,
              error: "Insufficient shares. Cannot withdraw more than total supply.",
            });
            continue;
          }

          // Simulate the withdrawal: assets = shares * totalAssets / totalSupply
          const assetsOut = (shares * currentAssets) / currentSupply;

          results.push({
            operationType: op.type,
            success: true,
            result: {
              sharesBurned: shares.toString(),
              assetsOut: assetsOut.toString(),
              newTotalAssets: (currentAssets - assetsOut).toString(),
              newTotalSupply: (currentSupply - shares).toString(),
            },
          });

          // Update simulated state
          currentAssets = currentAssets - assetsOut;
          currentSupply = currentSupply - shares;
        } else if (op.type === "claim") {
          if (vaultState !== "Active" && vaultState !== "Matured") {
            results.push({
              operationType: op.type,
              success: false,
              error: `Cannot claim yield in ${vaultState} state. Vault must be Active or Matured.`,
            });
            continue;
          }

          // Simulate claim: return yield data based on current state
          // In a real scenario this would query pending yield, but for simulation
          // we return the estimated pending yield
          const epochRows = await query<{ count: string }>(
            "SELECT COUNT(*)::text AS count FROM epochs WHERE vault_id = $1",
            [vault.id],
          );
          const epochCount = parseInt(epochRows[0]?.count ?? "0", 10);

          results.push({
            operationType: op.type,
            success: true,
            result: {
              pendingYield: "0",
              note: "Yield claim simulation - actual yield depends on distributed epochs.",
              currentEpoch: epochCount,
            },
          });
        }
      } catch (opErr) {
        results.push({
          operationType: op.type,
          success: false,
          error: opErr instanceof Error ? opErr.message : "Unknown error during simulation",
        });
      }
    }

    // Issue #1014: Cache result for 5 seconds
    await cacheSet(cacheKey, results, SIMULATION_CACHE_TTL_SECONDS);

    await logSimulation({
      contractId,
      operation: "multi_operation",
      params: { operations },
      result: results,
      durationMs: Date.now() - startTime,
      fromCache: false,
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
}