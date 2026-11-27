import { and, eq, gte, lt, ne } from "drizzle-orm";
import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { sumBy } from "../lib/format.js";
import { getRunTotalsByProduct, getStockLevels, sumOf } from "../lib/stock.js";
import { findWarehouseByCode } from "../lib/warehouses.js";
import { mockManager } from "../mocks/fixtures.js";
import {
	deliveries,
	deliveryItems,
	distributionRuns,
	products,
	stockMovements,
} from "../schema.js";
import {
	createStockReceiptSchema,
	stockSummaryQuerySchema,
} from "../types/stock.types.js";

const router = express.Router();

function monthRange(month: string) {
	const start = new Date(`${month}-01T00:00:00Z`);
	const end = new Date(start);
	end.setUTCMonth(end.getUTCMonth() + 1);
	return { start, end };
}

// Stock Summary page: overview cards, monthly movement and per-product table.
router.get("/stock-summary", async (req: Request, res: Response) => {
	const result = stockSummaryQuerySchema.safeParse(req.query);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}
	const { warehouse: warehouseCode, month } = result.data;

	let warehouseId: number | undefined;
	if (warehouseCode !== "all") {
		const warehouse = await findWarehouseByCode(warehouseCode);
		if (!warehouse)
			return res.status(404).json({ error: "Warehouse not found" });
		warehouseId = warehouse.id;
	}

	const { start, end } = monthRange(month);
	const runInWarehouse = warehouseId
		? eq(distributionRuns.warehouseId, warehouseId)
		: undefined;

	// None of these queries needs another's result, so start them all at once
	// and wait for every one to finish. Awaiting them one by one would pay the
	// database round trip (~100-200 ms to Supabase) once per query.
	const [
		activeProducts,
		stockLevels,
		openRuns,
		closedRuns,
		[deliveredRow],
		movementRows,
	] = await Promise.all([
		db
			.select()
			.from(products)
			.where(eq(products.isActive, true))
			.orderBy(products.name),

		// stock on hand at the end of the selected month
		getStockLevels({
			warehouseIds: warehouseId ? [warehouseId] : undefined,
			before: end,
		}),

		// stock still out with FDOs: runs that are not closed yet
		getRunTotalsByProduct(
			and(ne(distributionRuns.status, "closed"), runInWarehouse),
		),

		// variance: runs closed during the selected month
		getRunTotalsByProduct(
			and(
				eq(distributionRuns.status, "closed"),
				gte(distributionRuns.closedAt, start),
				lt(distributionRuns.closedAt, end),
				runInWarehouse,
			),
		),

		db
			.select({ delivered: sumOf(deliveryItems.quantity) })
			.from(deliveryItems)
			.innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
			.innerJoin(distributionRuns, eq(deliveries.runId, distributionRuns.id))
			.where(
				and(
					gte(deliveries.deliveredAt, start),
					lt(deliveries.deliveredAt, end),
					runInWarehouse,
				),
			),

		db
			.select({
				type: stockMovements.type,
				quantity: sumOf(stockMovements.quantity),
			})
			.from(stockMovements)
			.where(
				and(
					gte(stockMovements.createdAt, start),
					lt(stockMovements.createdAt, end),
					warehouseId ? eq(stockMovements.warehouseId, warehouseId) : undefined,
				),
			)
			.groupBy(stockMovements.type),
	]);
	const movementOf = (type: string) =>
		movementRows.find((row) => row.type === type)?.quantity ?? 0;

	const productRows = activeProducts.map((product) => {
		const stock = sumBy(
			stockLevels.filter((level) => level.productId === product.id),
			(level) => level.quantity,
		);
		const open = openRuns.get(product.id);
		const closed = closedRuns.get(product.id);
		const fdos = open ? open.issued - open.delivered : 0;
		const variance = closed
			? closed.issued - closed.delivered - closed.verified
			: 0;

		let status = "healthy";
		if (variance > 0) status = "variance-detected";
		else if (stock < product.reorderLevel) status = "low-stock";

		return {
			productId: product.id,
			name: product.name,
			sku: product.sku,
			stock,
			fdos,
			variance,
			status,
		};
	});

	const delivered = deliveredRow?.delivered ?? 0;
	const withFdos = sumBy(productRows, (row) => row.fdos);
	const variance = sumBy(productRows, (row) => row.variance);

	res.json({
		totals: {
			activeProducts: activeProducts.length,
			remainingStock: sumBy(productRows, (row) => row.stock),
			deliveredThisMonth: delivered,
			withFdos,
			stockVariance: variance,
		},
		movement: [
			{
				month,
				issued: -movementOf("issue"), // issues are stored as negative
				returned: movementOf("return"),
				delivered,
				variance,
				withFdos,
			},
		],
		products: productRows,
	});
});

// Update Stock dialog: record stock received from the factory.
router.post("/stock-receipts", async (req: Request, res: Response) => {
	const result = createStockReceiptSchema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}

	// TODO(auth): stock_movements.created_by_id must be the signed-in stock
	// manager. Until the auth lesson this returns a mock movement and writes
	// nothing. The real version looks up the warehouse and product, then
	// inserts a `receipt` movement with a positive quantity.
	const { warehouseCode, sku, quantity, reference } = result.data;
	res.status(201).json({
		id: 1,
		warehouseCode,
		sku,
		type: "receipt",
		quantity,
		reference: reference ?? null,
		createdBy: mockManager,
		createdAt: new Date().toISOString(),
	});
});

export default router;
