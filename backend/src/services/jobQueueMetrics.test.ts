import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({ query: vi.fn() }));

describe("Job Queue Metrics & Report Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports job_queue_pending_total, job_queue_failed_total, and job_duration_seconds in getMetrics()", async () => {
    const { query } = await import("../db/index.js");
    const { getMetrics, jobQueuePendingTotal, jobQueueFailedTotal, jobDurationSeconds } = await import("./metrics.js");

    (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { name: "indexer-backfill", count: "3" },
      { name: "webhook-deliver", count: "1" },
    ]);

    jobQueueFailedTotal.inc({ job_name: "indexer-backfill" });
    jobDurationSeconds.observe({ job_name: "indexer-backfill" }, 0.45);

    const metricsStr = await getMetrics();

    expect(metricsStr).toContain("job_queue_pending_total");
    expect(metricsStr).toContain("job_queue_failed_total");
    expect(metricsStr).toContain("job_duration_seconds");
    expect(metricsStr).toContain('job_name="indexer-backfill"');
  });

  it("generateVaultReports generates and caches annual report data for active vaults", async () => {
    const { query } = await import("../db/index.js");
    const { generateVaultReports } = await import("./reportWorker.js");
    const mockQuery = query as ReturnType<typeof vi.fn>;

    // 1. Fetch active vaults
    mockQuery.mockResolvedValueOnce([{ id: 1, contract_id: "C1" }]);
    // 2. Epochs query for vault 1
    mockQuery.mockResolvedValueOnce([{ epoch_count: "2", total_yield: "5000" }]);
    // 3. startSnapshotRows
    mockQuery.mockResolvedValueOnce([{ total_assets: "10000" }]);
    // 4. endSnapshotRows
    mockQuery.mockResolvedValueOnce([{ total_assets: "15000" }]);
    // 5. Upsert cached_reports query
    mockQuery.mockResolvedValueOnce([]);

    await generateVaultReports(2025);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cached_reports"),
      expect.arrayContaining([1, 2025, expect.any(String)]),
    );
  });
});
