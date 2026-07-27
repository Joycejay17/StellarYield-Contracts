import { Router } from "express";
import { getAnalyticsSummary, getTvlAggregate } from "../controllers/analytics.js";

export const analyticsRouter = Router();

analyticsRouter.get("/summary", getAnalyticsSummary);
analyticsRouter.get("/tvl", getTvlAggregate);
