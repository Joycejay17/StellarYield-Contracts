import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ getVaultAggregates: vi.fn() }));

vi.mock("../../services/vault.js", () => ({
  VaultService: vi.fn(() => ({ getVaultAggregates: mocks.getVaultAggregates })),
}));

import { getVaultAggregates } from "./vaults.js";

describe("Vault aggregates endpoint", () => {
  const mockRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() };
  const mockNext = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("returns aggregates from service", async () => {
    const agg = {
      totalAssets: { min: "0", max: "1000", avg: "500", sum: "1500" },
      expectedApy: { min: 1, max: 5, avg: 3 },
      depositorCount: { min: 0, max: 10, avg: 5 },
    };
    mocks.getVaultAggregates.mockResolvedValue(agg);
    const mockReq: any = { query: {} };
    await getVaultAggregates(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(agg);
  });

  it("passes state param to service", async () => {
    mocks.getVaultAggregates.mockResolvedValue({ totalAssets: { min: "0", max: "0", avg: "0", sum: "0" }, expectedApy: { min: 0, max: 0, avg: 0 }, depositorCount: { min: 0, max: 0, avg: 0 } });
    const mockReq: any = { query: { state: "Active" } };
    await getVaultAggregates(mockReq, mockRes, mockNext);
    expect(mocks.getVaultAggregates).toHaveBeenCalledWith("Active");
  });
});
