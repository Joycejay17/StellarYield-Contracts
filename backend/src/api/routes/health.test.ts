import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

vi.mock("../../db/index.js", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  },
}));

const readTotalVaultsMock = vi.fn();
vi.mock("../../services/stellar.js", () => ({
  readTotalVaults: readTotalVaultsMock,
}));

vi.mock("../../services/sseManager.js", () => ({
  sseManager: { getSseConnectionCount: vi.fn().mockReturnValue(0) },
}));

async function buildApp() {
  const { healthRouter } = await import("./health.js");
  const app = express();
  app.use("/health", healthRouter);
  return app;
}

describe("GET /health factory reachability (#844)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env["VAULT_FACTORY_CONTRACT_ID"] = "";
  });

  it("reports reachable: false and contractId: null when unset", async () => {
    delete process.env["VAULT_FACTORY_CONTRACT_ID"];
    const app = await buildApp();
    const res = await supertest(app).get("/health");

    expect(res.body.factory).toEqual({ reachable: false, contractId: null });
    expect(readTotalVaultsMock).not.toHaveBeenCalled();
  });

  it("reports reachable: true when the factory view call succeeds", async () => {
    process.env["VAULT_FACTORY_CONTRACT_ID"] = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    readTotalVaultsMock.mockResolvedValueOnce(5);

    const app = await buildApp();
    const res = await supertest(app).get("/health");

    expect(res.body.factory).toEqual({
      reachable: true,
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
  });

  it("reports reachable: false when the factory view call fails", async () => {
    process.env["VAULT_FACTORY_CONTRACT_ID"] = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    readTotalVaultsMock.mockRejectedValueOnce(new Error("RPC unreachable"));

    const app = await buildApp();
    const res = await supertest(app).get("/health");

    expect(res.body.factory).toEqual({
      reachable: false,
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
  });
});
