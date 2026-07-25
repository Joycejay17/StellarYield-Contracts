import { describe, it, expect, vi, beforeEach } from "vitest";

const workMock = vi.fn();

vi.mock("./boss.js", () => ({
  boss: { work: workMock },
  INDEXER_BACKFILL_QUEUE: "indexer-backfill",
}));

const queueBackfillMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../services/indexerSingleton.js", () => ({
  indexer: { queueBackfill: queueBackfillMock },
}));

describe("registerBackfillWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a handler on the indexer-backfill queue", async () => {
    const { registerBackfillWorker } = await import("./backfillWorker.js");
    await registerBackfillWorker();

    expect(workMock).toHaveBeenCalledWith("indexer-backfill", expect.any(Function));
  });

  it("delegates each job to indexer.queueBackfill with its range", async () => {
    const { registerBackfillWorker } = await import("./backfillWorker.js");
    await registerBackfillWorker();

    const handler = workMock.mock.calls[0][1];
    await handler([
      { id: "job-1", data: { fromLedger: 10, toLedger: 20 } },
      { id: "job-2", data: { fromLedger: 30, toLedger: 40 } },
    ]);

    expect(queueBackfillMock).toHaveBeenCalledWith(10, 20);
    expect(queueBackfillMock).toHaveBeenCalledWith(30, 40);
    expect(queueBackfillMock).toHaveBeenCalledTimes(2);
  });
});
