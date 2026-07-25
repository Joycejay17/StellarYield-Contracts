import { Router } from "express";
import { getVaultTypeDistribution } from "../controllers/factory.js";

export const factoryRouter = Router();

factoryRouter.get("/vault-type-distribution", getVaultTypeDistribution);
