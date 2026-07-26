import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getVault: vi.fn(),
  getVaultPositions: vi.fn(),
  getVaultEpochs: vi.fn(),
  listVaultOperators: vi.fn(),
  listVaultRoles: vi.fn(),
}));

vi.mock("../../services/vault.js", () => ({
  VaultService: vi.fn(() => ({
    getVault: mocks.getVault,
    getVaultPositions: mocks.getVaultPositions,
    getVaultEpochs: mocks.getVaultEpochs,
    listVaultOperators: mocks.listVaultOperators,
    listVaultRoles: mocks.listVaultRoles,
  })),
}));

import { getVault } from "./vaults.js";

describe("Embed relations in vault detail", () => {
  const mockRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() };
  const mockNext = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("embed=positions returns positions array", async () => {
    mocks.getVault.mockResolvedValue({ id: 1, contractId: "C1", updatedAt: new Date() });
    mocks.getVaultPositions.mockResolvedValue([{ id: 10, shares: "100" }]);
    const mockReq: any = { params: { contractId: "C1" }, query: { embed: "positions" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ positions: expect.any(Array) }));
  });

  it("embed=epochs returns epochs array", async () => {
    mocks.getVault.mockResolvedValue({ id: 2, contractId: "C2", updatedAt: new Date() });
    mocks.getVaultEpochs.mockResolvedValue([{ id: 1, epoch: 1 }]);
    const mockReq: any = { params: { contractId: "C2" }, query: { embed: "epochs" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ epochs: expect.any(Array) }));
  });

  it("embed=operators returns operators array", async () => {
    mocks.getVault.mockResolvedValue({ id: 3, contractId: "C3", updatedAt: new Date() });
    mocks.listVaultOperators.mockResolvedValue([{ operator: 'op1' }]);
    const mockReq: any = { params: { contractId: "C3" }, query: { embed: "operators" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ operators: expect.any(Array) }));
  });

  it("embed=roles returns roles array", async () => {
    mocks.getVault.mockResolvedValue({ id: 4, contractId: "C4", updatedAt: new Date() });
    mocks.listVaultRoles.mockResolvedValue([{ userAddress: 'u1', role: 'admin' }]);
    const mockReq: any = { params: { contractId: "C4" }, query: { embed: "roles" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ roles: expect.any(Array) }));
  });

  it("multiple embeds work", async () => {
    mocks.getVault.mockResolvedValue({ id: 5, contractId: "C5", updatedAt: new Date() });
    mocks.getVaultPositions.mockResolvedValue([]);
    mocks.getVaultEpochs.mockResolvedValue([]);
    const mockReq: any = { params: { contractId: "C5" }, query: { embed: "positions,epochs" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ positions: [], epochs: [] }));
  });

  it("unknown embed returns 400", async () => {
    mocks.getVault.mockResolvedValue({ id: 6, contractId: "C6", updatedAt: new Date() });
    const mockReq: any = { params: { contractId: "C6" }, query: { embed: "unknown" }, headers: {} };
    await getVault(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalled();
  });
});
