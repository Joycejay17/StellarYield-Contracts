import PgBoss from "pg-boss";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const INDEXER_BACKFILL_QUEUE = "indexer-backfill";

export const boss = new PgBoss(config.db.url);

boss.on("error", (err) => {
  logger.error({ err }, "pg-boss error");
});

let started = false;

/**
 * Start the pg-boss instance and ensure the queues this service uses exist.
 * Safe to call more than once — subsequent calls are a no-op while started.
 */
export async function startBoss(): Promise<void> {
  if (started) return;
  await boss.start();
  await boss.createQueue(INDEXER_BACKFILL_QUEUE);
  started = true;
  logger.info("pg-boss started");
}

export async function stopBoss(): Promise<void> {
  if (!started) return;
  started = false;
  await boss.stop();
  logger.info("pg-boss stopped");
}
