import { Router } from "express";
import { z } from "zod";
import { getAnalyticsSummary, getTvlAggregate, getYieldCorrelation } from "../controllers/analytics.js";
import { validateQuery } from "../middleware/validate.js";

const contractIdSchema = z
  .string()
  .length(56)
  .regex(/^C[A-Z2-7]{55}$/, "Invalid vault contract ID");

const yieldCorrelationQuerySchema = z.object({
  vaultA: contractIdSchema,
  vaultB: contractIdSchema,
});

export const analyticsRouter = Router();

analyticsRouter.get("/summary", getAnalyticsSummary);
analyticsRouter.get("/tvl", getTvlAggregate);
analyticsRouter.get(
  "/yield-correlation",
  validateQuery(yieldCorrelationQuerySchema),
  getYieldCorrelation,
);
