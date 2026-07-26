/**
 * resync-vault.ts
 *
 * Resynchronises a single vault's on-chain fields (total_assets, total_supply)
 * with the values reported by the Soroban RPC.  Run this after an indexer bug
 * has left the database out of sync with the chain.
 *
 * Usage:
 *   tsx src/scripts/resync-vault.ts --contractId <C...>
 *
 * Exits 0 on success, non-zero on any error (invalid input, RPC failure, etc.)
 *
 * Closes #805
 */
import "dotenv/config";
import { pool } from "../db/index.js";
import { logger } from "../logger.js";
import { readTotalAssets, readTotalSupply } from "../services/stellar.js";
import { VaultService } from "../services/vault.js";

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { contractId: string } {
  let contractId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--contractId") {
      contractId = argv[++i];
    }
  }

  if (!contractId) {
    logger.error("Missing required argument: --contractId <id>");
    process.exit(1);
  }

  // Basic Stellar contract address validation (56 chars, starts with 'C')
  if (!/^C[A-Z2-7]{55}$/.test(contractId)) {
    logger.error({ contractId }, "Invalid contract ID format — must be a 56-character Stellar contract address starting with 'C'");
    process.exit(1);
  }

  return { contractId };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function resyncVault(contractId: string): Promise<void> {
  logger.info({ contractId }, "Starting vault resync");

  // Fetch on-chain values — exit non-zero if RPC fails
  let totalAssets: bigint;
  let totalSupply: bigint;

  try {
    [totalAssets, totalSupply] = await Promise.all([
      readTotalAssets(contractId),
      readTotalSupply(contractId),
    ]);
  } catch (err) {
    logger.error({ err, contractId }, "RPC call failed — is the contract ID correct and the RPC endpoint reachable?");
    process.exit(2);
  }

  logger.info(
    { contractId, totalAssets: totalAssets.toString(), totalSupply: totalSupply.toString() },
    "Fetched on-chain values",
  );

  // Persist to database
  const vaultService = new VaultService();

  try {
    await vaultService.upsertVault({
      contractId,
      totalAssets: totalAssets.toString(),
      totalSupply: totalSupply.toString(),
    });
  } catch (err) {
    logger.error({ err, contractId }, "Database upsert failed");
    process.exit(3);
  }

  logger.info({ contractId }, "Vault resync complete");
}

// ── Entry point ──────────────────────────────────────────────────────────────

const { contractId } = parseArgs(process.argv.slice(2));

await resyncVault(contractId);

// Close the connection pool so the process can exit cleanly
await pool.end();
process.exit(0);
