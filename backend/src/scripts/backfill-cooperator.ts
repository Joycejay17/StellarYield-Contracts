import "dotenv/config";
import { query, pool } from "../db/index.js";
import { readCooperator } from "../services/stellar.js";
import { logger } from "../logger.js";

interface VaultRow {
  id: number;
  contract_id: string;
}

async function backfillCooperator(): Promise<void> {
  try {
    const vaults = await query<VaultRow>(
      `SELECT id, contract_id FROM vaults WHERE cooperator_address IS NULL`,
    );

    const total = vaults.length;
    let backfilled = 0;

    for (const vault of vaults) {
      try {
        const cooperatorAddress = await readCooperator(vault.contract_id);
        await query(`UPDATE vaults SET cooperator_address = $1, updated_at = NOW() WHERE id = $2`, [
          cooperatorAddress,
          vault.id,
        ]);
        backfilled++;
        logger.info(`Backfilled ${backfilled} of ${total} vaults`);
      } catch (err) {
        logger.error(
          { err, contractId: vault.contract_id },
          "Failed to backfill cooperator_address for vault",
        );
      }
    }

    logger.info({ backfilled, total }, "Cooperator backfill complete");
    await pool.end();
  } catch (err) {
    logger.error(err, "Cooperator backfill failed");
    process.exit(1);
  }
}

await backfillCooperator();
process.exit(0);
