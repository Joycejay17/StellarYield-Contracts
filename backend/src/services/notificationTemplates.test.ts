import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({ query: vi.fn() }));

import { query } from "../db/index.js";
import { getTemplate, renderTemplate } from "./notificationTemplates.js";

const mockQuery = query as ReturnType<typeof vi.fn>;

describe("renderTemplate", () => {
  it("substitutes dotted placeholder paths from the payload", () => {
    const out = renderTemplate(
      "Deposit of {{data.amount}} into {{data.contractId}}",
      { data: { amount: "100", contractId: "CABC" } },
    );
    expect(out).toBe("Deposit of 100 into CABC");
  });

  it("renders unresolved placeholders as an empty string", () => {
    expect(renderTemplate("hello {{data.missing}} world", { data: {} })).toBe("hello  world");
  });

  it("renders nested objects as compact JSON", () => {
    expect(renderTemplate("{{data.meta}}", { data: { meta: { a: 1 } } })).toBe('{"a":1}');
  });

  it("tolerates surrounding whitespace in the placeholder", () => {
    expect(renderTemplate("x {{ data.v }} y", { data: { v: "z" } })).toBe("x z y");
  });
});

describe("getTemplate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the row for a matching (eventType, channel) pair", async () => {
    const row = {
      id: 1,
      event_type: "deposit",
      channel: "webhook",
      body_template: "hi",
      active: true,
    };
    mockQuery.mockResolvedValue([row]);

    await expect(getTemplate("deposit", "webhook")).resolves.toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("notification_templates"), [
      "deposit",
      "webhook",
    ]);
  });

  it("returns null when no template exists", async () => {
    mockQuery.mockResolvedValue([]);
    await expect(getTemplate("nope", "webhook")).resolves.toBeNull();
  });
});
