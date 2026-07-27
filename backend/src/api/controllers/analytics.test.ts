import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../db/index.js", () => ({ query: mocks.query }));
vi.mock("../../cache/redis.js", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));

import { getTvlAggregate } from "./analytics.js";

describe("GET /api/v1/analytics/tvl (#775)", () => {
  const mockNext = vi.fn();

  const buildRes = () => {
    const res: any = {};
    res.set = vi.fn().mockReturnThis();
    res.json = vi.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns the aggregate TVL, active vault count, and funding vault count", async () => {
    mocks.query.mockResolvedValue([
      { total_value_locked: "12345", active_vault_count: "3", funding_vault_count: "2" },
    ]);
    const res = buildRes();

    await getTvlAggregate({} as any, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({
      totalValueLocked: "12345",
      activeVaultCount: 3,
      fundingVaultCount: 2,
    });
  });

  it("scopes the query to non-archived vaults", async () => {
    mocks.query.mockResolvedValue([
      { total_value_locked: "0", active_vault_count: "0", funding_vault_count: "0" },
    ]);
    const res = buildRes();

    await getTvlAggregate({} as any, res, mockNext);

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE archived = FALSE"));
  });

  it("sets a 30 second Cache-Control header", async () => {
    mocks.query.mockResolvedValue([
      { total_value_locked: "0", active_vault_count: "0", funding_vault_count: "0" },
    ]);
    const res = buildRes();

    await getTvlAggregate({} as any, res, mockNext);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "max-age=30");
  });

  it("defaults to zeros when there are no vaults", async () => {
    mocks.query.mockResolvedValue([]);
    const res = buildRes();

    await getTvlAggregate({} as any, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({
      totalValueLocked: "0",
      activeVaultCount: 0,
      fundingVaultCount: 0,
    });
  });

  it("forwards errors to next", async () => {
    const err = new Error("db down");
    mocks.query.mockRejectedValue(err);
    const res = buildRes();

    await getTvlAggregate({} as any, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
