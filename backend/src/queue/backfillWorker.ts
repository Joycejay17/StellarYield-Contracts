import { boss, INDEXER_BACKFILL_QUEUE } from "./boss.js";
import { indexer } from "../services/indexerSingleton.js";
import { logger } from "../logger.js";

export interface IndexerBackfillJobData {
  fromLedger: number;
  toLedger: number;
}

/**
 * Register the worker that processes "indexer-backfill" jobs. Persisting the
 * range via pg-boss means an admin-triggered backfill survives a process
 * restart instead of being lost like the old in-memory queue (#133, #846).
 */
export async function registerBackfillWorker(): Promise<void> {
  await boss.work<IndexerBackfillJobData>(INDEXER_BACKFILL_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const { fromLedger, toLedger } = job.data;
      logger.info({ jobId: job.id, fromLedger, toLedger }, "Processing indexer-backfill job");
      await indexer.queueBackfill(fromLedger, toLedger);
    }
  });
}
