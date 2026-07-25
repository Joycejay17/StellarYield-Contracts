import { describe, it, expect, vi, beforeEach } from "vitest";

const queueBackfillMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./indexerSingleton.js", () => ({
  indexer: { queueBackfill: queueBackfillMock },
}));

describe("processIndexerBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to indexer.queueBackfill with the given range", async () => {
    const { processIndexerBackfill } = await import("./indexerBackfillWorker.js");

    await processIndexerBackfill(10, 20);

    expect(queueBackfillMock).toHaveBeenCalledWith(10, 20);
  });
});
