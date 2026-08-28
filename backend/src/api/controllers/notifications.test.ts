import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  validateWebhookUrl: vi.fn().mockResolvedValue(undefined),
  getTemplate: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({ query: mocks.query }));
vi.mock("../../logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("../../services/notifications.js", () => ({
  validateWebhookUrl: mocks.validateWebhookUrl,
}));
vi.mock("../../services/notificationTemplates.js", async () => {
  const actual = await vi.importActual<typeof import("../../services/notificationTemplates.js")>(
    "../../services/notificationTemplates.js",
  );
  return { ...actual, getTemplate: mocks.getTemplate };
});

import { previewNotification, notificationsHealth } from "./notifications.js";

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateWebhookUrl.mockResolvedValue(undefined);
});

describe("previewNotification (#1026)", () => {
  it("renders the template with the sample payload", async () => {
    mocks.getTemplate.mockResolvedValue({
      body_template: "Deposit of {{data.amount}}",
    });
    const req = {
      body: { eventType: "deposit", channel: "webhook", samplePayload: { data: { amount: "42" } } },
    } as any;
    const res = mockRes();

    await previewNotification(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ rendered: "Deposit of 42" });
  });

  it("returns 404 when no template exists for the pair", async () => {
    mocks.getTemplate.mockResolvedValue(null);
    const req = {
      body: { eventType: "deposit", channel: "sms", samplePayload: {} },
    } as any;
    const res = mockRes();

    await previewNotification(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "TemplateNotFound" }),
    );
  });

  it("does not send anything (no job queue / fetch involvement)", async () => {
    mocks.getTemplate.mockResolvedValue({ body_template: "x" });
    const fetchSpy = vi.spyOn(global, "fetch");
    const req = { body: { eventType: "deposit", channel: "webhook", samplePayload: {} } } as any;

    await previewNotification(req, mockRes(), vi.fn());

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("notificationsHealth (#1027)", () => {
  it("reports reachable + latency for responsive channels", async () => {
    mocks.query.mockResolvedValue([{ id: 1, url: "https://a.example" }]);
    vi.spyOn(global, "fetch").mockResolvedValue({ status: 200 } as Response);
    const res = mockRes();

    await notificationsHealth({} as any, res, vi.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.channels).toHaveLength(1);
    expect(payload.channels[0].id).toBe(1);
    expect(payload.channels[0].reachable).toBe(true);
    expect(typeof payload.channels[0].latencyMs).toBe("number");
  });

  it("reports reachable:false and latencyMs:null for unreachable channels", async () => {
    mocks.query.mockResolvedValue([{ id: 2, url: "https://down.example" }]);
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));
    const res = mockRes();

    await notificationsHealth({} as any, res, vi.fn());

    expect(res.json.mock.calls[0][0].channels[0]).toEqual({
      id: 2,
      url: "https://down.example",
      reachable: false,
      latencyMs: null,
    });
  });

  it("marks a channel unreachable when it fails the SSRF check", async () => {
    mocks.query.mockResolvedValue([{ id: 3, url: "https://internal.example" }]);
    mocks.validateWebhookUrl.mockRejectedValue(new Error("private address"));
    const fetchSpy = vi.spyOn(global, "fetch");
    const res = mockRes();

    await notificationsHealth({} as any, res, vi.fn());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].channels[0].reachable).toBe(false);
    expect(res.json.mock.calls[0][0].channels[0].latencyMs).toBeNull();
  });
});
