import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { outlets } from "../schema.js";

const router = express.Router();

router.get("/outlets", async (_req: Request, res: Response) => {
	res.json(await db.select().from(outlets).orderBy(outlets.area, outlets.name));
});

export default router;
