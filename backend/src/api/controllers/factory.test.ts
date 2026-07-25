import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/index.js", () => ({ query: vi.fn() }));

async function getTestContext() {
  const { query } = await import("../../db/index.js");
  const { getVaultTypeDistribution } = await import("./factory.js");
  return { query: query as ReturnType<typeof vi.fn>, getVaultTypeDistribution };
}

describe("getVaultTypeDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns vault type counts with percentages summing to 100", async () => {
    const { query, getVaultTypeDistribution } = await getTestContext();
    query.mockResolvedValueOnce([
      { vault_type: "real-estate", count: "3" },
      { vault_type: "treasury", count: "1" },
    ]);

    const req = {} as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    await getVaultTypeDistribution(req, res, next);

    expect(res.json).toHaveBeenCalledWith([
      { vaultType: "real-estate", count: 3, percentage: 75 },
      { vaultType: "treasury", count: 1, percentage: 25 },
    ]);
  });

  it("omits categories with no vaults and returns an empty array when there are none", async () => {
    const { query, getVaultTypeDistribution } = await getTestContext();
    query.mockResolvedValueOnce([]);

    const req = {} as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    await getVaultTypeDistribution(req, res, next);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("forwards errors to next", async () => {
    const { query, getVaultTypeDistribution } = await getTestContext();
    const err = new Error("db down");
    query.mockRejectedValueOnce(err);

    const req = {} as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    await getVaultTypeDistribution(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
