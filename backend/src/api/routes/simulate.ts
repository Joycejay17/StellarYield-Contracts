import { Router } from "express";
import { z } from "zod";
import {
  simulateDeposit,
  simulateWithdraw,
  simulateYieldClaim,
} from "../controllers/simulate.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { simulateLimiter } from "../middleware/rateLimit.js";

const contractAddressSchema = z.string().length(56).regex(/^C[A-Z2-7]{55}$/);

const simulateParamsSchema = z.object({
  contractId: contractAddressSchema,
});

const simulateDepositQuerySchema = z.object({
  amount: z.string().regex(/^\d+$/, "must be a non-negative integer"),
  userAddress: z.string().length(56).regex(/^G[A-Z2-7]{55}$/),
});

const simulateWithdrawQuerySchema = z.object({
  shares: z.string().regex(/^\d+$/, "must be a non-negative integer"),
  userAddress: z.string().length(56).regex(/^G[A-Z2-7]{55}$/),
});

const simulateYieldClaimQuerySchema = z.object({
  userAddress: z.string().length(56).regex(/^G[A-Z2-7]{55}$/),
});

export const simulateRouter = Router();

simulateRouter.use(simulateLimiter);

simulateRouter.get(
  "/:contractId/deposit",
  validateParams(simulateParamsSchema),
  validateQuery(simulateDepositQuerySchema),
  simulateDeposit,
);

simulateRouter.get(
  "/:contractId/withdraw",
  validateParams(simulateParamsSchema),
  validateQuery(simulateWithdrawQuerySchema),
  simulateWithdraw,
);

simulateRouter.get(
  "/:contractId/yield-claim",
  validateParams(simulateParamsSchema),
  validateQuery(simulateYieldClaimQuerySchema),
  simulateYieldClaim,
);