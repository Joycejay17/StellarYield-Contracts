import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listVaults: vi.fn(),
}));

vi.mock("../../services/vault.js", () => ({
  VaultService: vi.fn(() => ({
    listVaults: mocks.listVaults,
  })),
  validateFilterTree: (f: any) => {
    // reuse real validator not available here; keep simple: reject unknown field
    if (f && f.field === "nonexistent") return 'Unknown filter field "nonexistent"';
    if (f && f.depthTooDeep) return 'Filter tree depth exceeds maximum of 3';
    return undefined;
  },
  VAULT_FIELD_ALLOWLIST: ["contractId", "state", "totalAssets"],
}));

import { listVaults } from "./vaults.js";

describe("Vault filter parsing", () => {
  const mockRes: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on malformed JSON", async () => {
    const mockReq: any = { query: { page: 1, pageSize: 20, sort: "created_at", order: "desc", filter: "not-json" } };
    await listVaults(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "BadRequest", message: "filter must be valid JSON" });
  });

  it("returns 400 for unknown field in filter", async () => {
    const bad = JSON.stringify({ field: "nonexistent", op: "eq", value: "x" });
    const mockReq: any = { query: { page: 1, pageSize: 20, sort: "created_at", order: "desc", filter: bad } };
    await listVaults(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "BadRequest", message: 'Unknown filter field "nonexistent"' });
  });

  it("passes parsed filter to VaultService.listVaults", async () => {
    const f = { field: "state", op: "eq", value: "Active" };
    mocks.listVaults.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });
    const mockReq: any = { query: { page: 1, pageSize: 20, sort: "created_at", order: "desc", filter: JSON.stringify(f) } };
    await listVaults(mockReq, mockRes, mockNext);
    expect(mocks.listVaults).toHaveBeenCalledWith(expect.objectContaining({ filter: f }));
  });

  it("rejects overly deep filter tree", async () => {
    const deep = JSON.stringify({ depthTooDeep: true });
    const mockReq: any = { query: { page: 1, pageSize: 20, sort: "created_at", order: "desc", filter: deep } };
    await listVaults(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalled();
  });
});
