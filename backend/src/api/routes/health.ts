import { readFileSync } from "fs";
import { Router } from "express";
import { pool } from "../../db/index.js";
import { config } from "../../config.js";
import { readTotalVaults } from "../../services/stellar.js";
import { sseManager } from "../../services/sseManager.js";

const { version } = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf-8"),
) as { version: string };

export const healthRouter = Router();

const FACTORY_HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Check whether the factory contract is reachable via a lightweight view
 * call, bounded by a timeout so a stalled RPC never blocks /health (#844).
 */
async function checkFactoryReachable(contractId: string): Promise<boolean> {
  try {
    await Promise.race([
      readTotalVaults(contractId),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("factory reachability check timed out")), FACTORY_HEALTH_CHECK_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

healthRouter.get("/", async (_req, res) => {
  // Surface connection pool utilisation so operators can detect connection
  // exhaustion before it causes query timeouts (#657). `waiting > 0` means
  // requests are queued for a connection — a sign of pool pressure.
  const dbPool = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  const contractId = config.stellar.vaultFactoryContractId || null;
  const factory = {
    reachable: contractId !== null && (await checkFactoryReachable(contractId)),
    contractId,
  };
  const sseConnections = sseManager.getSseConnectionCount();

  try {
    await pool.query("SELECT 1");
    res.json({ version, status: "ok", dbPool, factory, sseConnections });
  } catch {
    res.status(503).json({ version, status: "error", dbPool, factory, sseConnections });
  }
});
