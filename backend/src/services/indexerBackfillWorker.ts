import { indexer } from "./indexerSingleton.js";
import { logger } from "../logger.js";

/**
 * Process a single "indexer-backfill" job, replaying the existing backfill
 * logic for the requested ledger range (#846).
 */
export async function processIndexerBackfill(fromLedger: number, toLedger: number): Promise<void> {
  logger.info({ fromLedger, toLedger }, "Processing indexer-backfill job");
  await indexer.queueBackfill(fromLedger, toLedger);
}
