import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { indexer } from "./services/indexerSingleton.js";
import { EventsPruner } from "./services/eventsPruner.js";
import { startBoss, stopBoss } from "./queue/boss.js";
import { registerBackfillWorker } from "./queue/backfillWorker.js";

const app = createApp();
const pruner = new EventsPruner();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, "StellarYield backend started");
  void indexer.start();
  pruner.start();
  void startBoss()
    .then(() => registerBackfillWorker())
    .catch((err) => logger.error({ err }, "Failed to start pg-boss"));
});

function shutdown(): void {
  logger.info("Shutting down");
  indexer.stop();
  pruner.stop();
  void stopBoss();
  server.close(() => {
    logger.info("StellarYield backend stopped");
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
