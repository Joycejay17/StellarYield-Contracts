import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({ query: vi.fn() }));
vi.mock("../logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("./sse.js", () => ({
  sseService: { broadcastWebhookDelivery: vi.fn() },
}));
vi.mock("./jobQueue.js", () => ({
  jobQueue: { send: vi.fn().mockResolvedValue("job-1"), start: vi.fn(), stop: vi.fn() },
}));

import { query } from "../db/index.js";
import { jobQueue } from "./jobQueue.js";
import { NotificationService } from "./notifications.js";

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockSend = jobQueue.send as ReturnType<typeof vi.fn>;

describe("NotificationService.notify — channel priority ordering (#1025)", () => {
  let svc: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue("job-1");
    svc = new NotificationService();
  });

  it("attempts channels with a lower priority value first", async () => {
    // Returned already ordered by the SQL `ORDER BY priority ASC`.
    mockQuery.mockResolvedValue([
      { id: 10, url: "https://a", events: ["deposit"], secret: null, priority: -5, fallback_channel: null },
      { id: 20, url: "https://b", events: ["deposit"], secret: null, priority: 0, fallback_channel: null },
      { id: 30, url: "https://c", events: ["deposit"], secret: null, priority: 3, fallback_channel: null },
    ]);

    await svc.notify("deposit", { amount: "100" });

    const dispatchedWebhookIds = mockSend.mock.calls.map((c) => c[1].webhookId);
    expect(dispatchedWebhookIds).toEqual([10, 20, 30]);
  });

  it("dispatches equal-priority channels together, before the next tier", async () => {
    mockQuery.mockResolvedValue([
      { id: 1, url: "https://a", events: ["deposit"], secret: null, priority: 0, fallback_channel: null },
      { id: 2, url: "https://b", events: ["deposit"], secret: null, priority: 0, fallback_channel: null },
      { id: 3, url: "https://c", events: ["deposit"], secret: null, priority: 1, fallback_channel: null },
    ]);

    const dispatchOrder: number[] = [];
    let releaseTierZero: () => void = () => {};
    const tierZeroGate = new Promise<void>((resolve) => {
      releaseTierZero = resolve;
    });

    mockSend.mockImplementation(async (_name: string, data: { webhookId: number }) => {
      dispatchOrder.push(data.webhookId);
      if (data.webhookId === 1 || data.webhookId === 2) await tierZeroGate;
      return "job-1";
    });

    const notifyPromise = svc.notify("deposit", {});
    await Promise.resolve();

    // Both priority-0 channels started; the priority-1 channel has not.
    expect(dispatchOrder).toEqual([1, 2]);

    releaseTierZero();
    await notifyPromise;

    expect(dispatchOrder).toEqual([1, 2, 3]);
  });
});
