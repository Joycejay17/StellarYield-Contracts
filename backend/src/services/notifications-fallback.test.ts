import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]),
}));
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

describe("NotificationService.processRetries — fallback escalation (#1024)", () => {
  let svc: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue("job-1");
    svc = new NotificationService();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("connection refused"));
  });

  function mockRetryRow(attempt: number, fallbackChannel: number | null) {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM webhook_deliveries wd")) {
        return [
          {
            id: 500,
            webhook_id: 7,
            payload: '{"event":"deposit"}',
            attempt,
            fallback_channel: fallbackChannel,
          },
        ];
      }
      if (sql.includes("FROM webhooks WHERE id = $1")) {
        return [
          {
            id: 7,
            url: "https://primary",
            events: ["deposit"],
            secret: null,
            consecutive_failures: 5,
            priority: 0,
            fallback_channel: fallbackChannel,
          },
        ];
      }
      return [];
    });
  }

  it("enqueues delivery to the fallback channel once the primary exhausts retries", async () => {
    mockRetryRow(5, 99); // attempt 5 -> nextAttempt 6 == exhausted

    await svc.processRetries();

    expect(mockSend).toHaveBeenCalledWith("webhook-deliver", {
      webhookId: 99,
      payload: '{"event":"deposit"}',
    });
  });

  it("does not escalate while retries remain", async () => {
    mockRetryRow(2, 99);

    await svc.processRetries();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not escalate when no fallback channel is configured", async () => {
    mockRetryRow(5, null);

    await svc.processRetries();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not escalate when the primary delivery finally succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    mockRetryRow(5, 99);

    await svc.processRetries();

    expect(mockSend).not.toHaveBeenCalled();
  });
});
