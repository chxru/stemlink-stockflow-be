import { eq } from "drizzle-orm";
import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { getStockLevels } from "../lib/stock.js";
import { findWarehouseByCode } from "../lib/warehouses.js";
import { products, warehouses } from "../schema.js";

const router = express.Router();

router.get("/warehouses", async (_req: Request, res: Response) => {
	res.json(await db.select().from(warehouses).orderBy(warehouses.code));
});

// Available stock per product in one warehouse (used by the request dialog).
router.get(
	"/warehouses/:code/stock",
	async (req: Request<{ code: string }>, res: Response) => {
		const warehouse = await findWarehouseByCode(req.params.code);
		if (!warehouse)
			return res.status(404).json({ error: "Warehouse not found" });

		const activeProducts = await db
			.select()
			.from(products)
			.where(eq(products.isActive, true))
			.orderBy(products.name);
		const levels = await getStockLevels({ warehouseIds: [warehouse.id] });

		res.json(
			activeProducts.map((product) => ({
				productId: product.id,
				sku: product.sku,
				name: product.name,
				available:
					levels.find((level) => level.productId === product.id)?.quantity ?? 0,
			})),
		);
	},
);

export default router;
