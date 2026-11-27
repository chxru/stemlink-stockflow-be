import { eq } from "drizzle-orm";
import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { products } from "../schema.js";

const router = express.Router();

router.get("/products", async (_req: Request, res: Response) => {
	res.json(
		await db
			.select()
			.from(products)
			.where(eq(products.isActive, true))
			.orderBy(products.name),
	);
});

export default router;
