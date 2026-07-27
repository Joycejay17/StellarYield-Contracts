import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserService } from "./user.js";
import * as db from "../db/index.js";

vi.mock("../db/index.js");
vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("./yield.js", () => ({
  YieldService: vi.fn(() => ({
    getUserPendingYield: vi.fn().mockResolvedValue({ pendingYield: "0", epochs: [] }),
  })),
}));

const TEST_ADDRESS = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJBBX7UYXVXPXD5XNMJXVXV";

describe("UserService.getUserPortfolioAllocation (#776)", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    vi.clearAllMocks();
  });

  it("returns an empty allocations array for a user with no positions", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([]);
    const result = await userService.getUserPortfolioAllocation(TEST_ADDRESS);
    expect(result).toEqual({ allocations: [] });
  });

  it("groups deposited amounts by rwa_category with percentages summing to 100", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([
      { category: "Real Estate", deposited: "600" },
      { category: "Treasury", deposited: "300" },
      { category: "Uncategorized", deposited: "100" },
    ]);

    const result = await userService.getUserPortfolioAllocation(TEST_ADDRESS);

    expect(result.allocations).toEqual([
      { category: "Real Estate", deposited: "600", percentage: 60 },
      { category: "Treasury", deposited: "300", percentage: 30 },
      { category: "Uncategorized", deposited: "100", percentage: 10 },
    ]);

    const totalPercentage = result.allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100, 10);
  });

  it("handles uneven splits while still summing to ~100", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([
      { category: "Real Estate", deposited: "1" },
      { category: "Treasury", deposited: "1" },
      { category: "Commodities", deposited: "1" },
    ]);

    const result = await userService.getUserPortfolioAllocation(TEST_ADDRESS);
    const totalPercentage = result.allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100, 10);
  });
});

describe("UserService.getUserPortfolioDiversification (#777)", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    vi.clearAllMocks();
  });

  it("returns a score of 0 for a user with a single position", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([
      { category: "Real Estate", deposited: "1000" },
    ]);

    const result = await userService.getUserPortfolioDiversification(TEST_ADDRESS);

    expect(result.score).toBe(0);
    expect(result.vaultCount).toBe(1);
    expect(result.categoryCount).toBe(1);
    expect(result.herfindahlIndex).toBe(1);
  });

  it("returns a score close to 75 for equal deposits across four vaults", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([
      { category: "Real Estate", deposited: "250" },
      { category: "Treasury", deposited: "250" },
      { category: "Commodities", deposited: "250" },
      { category: "Private Credit", deposited: "250" },
    ]);

    const result = await userService.getUserPortfolioDiversification(TEST_ADDRESS);

    expect(result.score).toBe(75);
    expect(result.vaultCount).toBe(4);
    expect(result.categoryCount).toBe(4);
    expect(result.herfindahlIndex).toBeCloseTo(0.25, 10);
  });

  it("returns zeroed-out values for a user with no positions", async () => {
    vi.mocked(db.query).mockResolvedValueOnce([]);
    const result = await userService.getUserPortfolioDiversification(TEST_ADDRESS);
    expect(result).toEqual({ score: 0, vaultCount: 0, categoryCount: 0, herfindahlIndex: 0 });
  });
});
