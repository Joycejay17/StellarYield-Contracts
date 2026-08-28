import type { Request, Response, NextFunction } from "express";
import { logger } from "../../logger.js";
import { readShareBalance, readTotalSupply, readTotalAssets } from "../../services/stellar.js";

interface SimulationResult {
  contractId: string;
  operation: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs: number;
  fromCache: boolean;
}

async function logSimulation(result: SimulationResult): Promise<void> {
  const logData: Record<string, unknown> = {
    contractId: result.contractId,
    operation: result.operation,
    params: result.params,
    durationMs: result.durationMs,
    fromCache: result.fromCache,
  };

  if (logger.level === "debug") {
    logData.result = result.result;
  }

  logger.debug(logData, "Simulation request");
}

export async function simulateDeposit(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
    const { contractId } = req.params as { contractId: string };
    const { amount, userAddress } = req.query as { amount: string; userAddress: string };

    const amountBigInt = BigInt(amount);
    const currentBalance = await readShareBalance(contractId, userAddress);
    const totalSupply = await readTotalSupply(contractId);
    const totalAssets = await readTotalAssets(contractId);

    const shares = totalSupply > 0n
      ? (amountBigInt * totalSupply) / totalAssets
      : amountBigInt;

    const operationResult = {
      shares: shares.toString(),
      currentBalance: currentBalance.toString(),
      totalSupply: totalSupply.toString(),
      totalAssets: totalAssets.toString(),
    };

    const result: SimulationResult = {
      contractId,
      operation: "deposit",
      params: { amount, userAddress },
      result: operationResult,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };

    await logSimulation(result);
    res.json(operationResult);
  } catch (err) {
    next(err);
  }
}

export async function simulateWithdraw(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
    const { contractId } = req.params as { contractId: string };
    const { shares, userAddress } = req.query as { shares: string; userAddress: string };

    const sharesBigInt = BigInt(shares);
    const currentBalance = await readShareBalance(contractId, userAddress);
    const totalSupply = await readTotalSupply(contractId);
    const totalAssets = await readTotalAssets(contractId);

    const amount = totalSupply > 0n
      ? (sharesBigInt * totalAssets) / totalSupply
      : 0n;

    const operationResult = {
      amount: amount.toString(),
      currentBalance: currentBalance.toString(),
      totalSupply: totalSupply.toString(),
      totalAssets: totalAssets.toString(),
    };

    const result: SimulationResult = {
      contractId,
      operation: "withdraw",
      params: { shares, userAddress },
      result: operationResult,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };

    await logSimulation(result);
    res.json(operationResult);
  } catch (err) {
    next(err);
  }
}

export async function simulateYieldClaim(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
    const { contractId } = req.params as { contractId: string };
    const { userAddress } = req.query as { userAddress: string };

    const currentBalance = await readShareBalance(contractId, userAddress);
    const totalSupply = await readTotalSupply(contractId);
    const totalAssets = await readTotalAssets(contractId);

    const operationResult = {
      currentBalance: currentBalance.toString(),
      totalSupply: totalSupply.toString(),
      totalAssets: totalAssets.toString(),
    };

    const result: SimulationResult = {
      contractId,
      operation: "yield_claim",
      params: { userAddress },
      result: operationResult,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };

    await logSimulation(result);
    res.json(operationResult);
  } catch (err) {
    next(err);
  }
}