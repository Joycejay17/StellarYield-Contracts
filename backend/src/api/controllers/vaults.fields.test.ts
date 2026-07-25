import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listVaults: vi.fn(),
  getVault: vi.fn(),
}));

vi.mock("../../services/vault.js", () => ({
  VaultService: vi.fn(() => ({
    listVaults: mocks.listVaults,
    getVault: mocks.getVault,
  })),
  VAULT_FIELD_ALLOWLIST: ["id", "contractId", "state", "totalAssets"],
  pickVaultFields: (v: any, fields: string[]) => {
    const keep = new Set(fields.includes("id") ? fields : ["id", ...fields]);
    return Object.fromEntries(Object.entries(v).filter(([k]) => keep.has(k)));
  },
}));

import { listVaults, getVault } from "./vaults.js";

describe("Sparse fieldsets", () => {
  const mockRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() };
  const mockNext = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("returns only requested fields for detail endpoint", async () => {
    const full = { id: 1, contractId: "CABC", state: "Active", totalAssets: "1000", updatedAt: new Date() };
    mocks.getVault.mockResolvedValue(full);
    const mockReq: any = { params: { contractId: "CABC" }, query: { fields: "contractId,state" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, contractId: "CABC", state: "Active" }));
  });

  it("unknown field returns 400", async () => {
    const mockReq: any = { params: { contractId: "CABC" }, query: { fields: "contractId,fakeField" } };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalled();
  });

  it("absent fields returns full object", async () => {
    const full = { id: 2, contractId: "CDEF", state: "Funding", totalAssets: "0", updatedAt: new Date() };
    mocks.getVault.mockResolvedValue(full);
    const mockReq: any = { params: { contractId: "CDEF" }, query: {}, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(full);
  });

  it("single field selection works", async () => {
    const full = { id: 3, contractId: "CGHI", state: "Active", totalAssets: "500", updatedAt: new Date() };
    mocks.getVault.mockResolvedValue(full);
    const mockReq: any = { params: { contractId: "CGHI" }, query: { fields: "contractId" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ id: 3, contractId: "CGHI" }));
  });
});
