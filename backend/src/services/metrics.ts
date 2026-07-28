import client from "prom-client";

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

export const indexerEventsProcessedTotal = new client.Counter({
  name: "indexer_events_processed_total",
  help: "Total number of on-chain events processed by the indexer",
  registers: [register],
});

export const indexerLastLedger = new client.Gauge({
  name: "indexer_last_ledger",
  help: "Last indexed ledger sequence number",
  registers: [register],
});

export const dbQueryDurationSeconds = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["query"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const jobQueuePendingTotal = new client.Gauge({
  name: "job_queue_pending_total",
  help: "Total number of pending jobs in queue",
  labelNames: ["job_name"] as const,
  registers: [register],
});

export const jobQueueFailedTotal = new client.Counter({
  name: "job_queue_failed_total",
  help: "Total number of failed jobs in queue",
  labelNames: ["job_name"] as const,
  registers: [register],
});

export const jobDurationSeconds = new client.Histogram({
  name: "job_duration_seconds",
  help: "Job execution duration in seconds",
  labelNames: ["job_name"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

export async function updateJobQueuePendingMetrics(): Promise<void> {
  try {
    const { query } = await import("../db/index.js");
    const rows = await query<{ name: string; count: string }>(
      `SELECT name, COUNT(*)::text AS count
       FROM pgboss.job
       WHERE state IN ('created', 'retry')
       GROUP BY name`,
    );
    jobQueuePendingTotal.reset();
    for (const row of rows) {
      jobQueuePendingTotal.set({ job_name: row.name }, parseInt(row.count, 10));
    }
  } catch {
    // Ignore errors when database is unavailable in test environments
  }
}

export async function getMetrics(): Promise<string> {
  await updateJobQueuePendingMetrics();
  return register.metrics();
}

