import {
	type AnyColumn,
	and,
	eq,
	inArray,
	lt,
	type SQL,
	sql,
} from "drizzle-orm";

import { db } from "../db.js";
import {
	deliveries,
	deliveryItems,
	distributionRuns,
	runItems,
	stockMovements,
} from "../schema.js";

// SUM() that returns 0 instead of NULL, as a JS number.
export const sumOf = (column: AnyColumn | SQL) =>
	sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/**
 * Stock on hand per warehouse and product.
 * There is no quantity column anywhere: stock is the SUM of the ledger.
 */
export async function getStockLevels(
	filter: {
		warehouseIds?: number[] | undefined;
		before?: Date | undefined;
	} = {},
) {
	return db
		.select({
			warehouseId: stockMovements.warehouseId,
			productId: stockMovements.productId,
			quantity: sumOf(stockMovements.quantity),
		})
		.from(stockMovements)
		.where(
			and(
				filter.warehouseIds
					? inArray(stockMovements.warehouseId, filter.warehouseIds)
					: undefined,
				filter.before ? lt(stockMovements.createdAt, filter.before) : undefined,
			),
		)
		.groupBy(stockMovements.warehouseId, stockMovements.productId);
}

export const stockKey = (warehouseId: number, productId: number) =>
	`${warehouseId}:${productId}`;

/** Stock levels as a lookup: stockKey(warehouseId, productId) -> quantity. */
export async function getStockLookup(warehouseIds: number[]) {
	const rows = await getStockLevels({ warehouseIds });
	return new Map(
		rows.map((row) => [stockKey(row.warehouseId, row.productId), row.quantity]),
	);
}

/**
 * Issued, delivered and verified-return totals per product, over the
 * distribution runs matching `runFilter`.
 */
export async function getRunTotalsByProduct(runFilter: SQL | undefined) {
	// the two queries are independent, so run them at the same time
	const [issuedRows, deliveredRows] = await Promise.all([
		db
			.select({
				productId: runItems.productId,
				issued: sumOf(runItems.issuedQty),
				verified: sumOf(runItems.verifiedReturnQty),
			})
			.from(runItems)
			.innerJoin(distributionRuns, eq(runItems.runId, distributionRuns.id))
			.where(runFilter)
			.groupBy(runItems.productId),

		db
			.select({
				productId: deliveryItems.productId,
				delivered: sumOf(deliveryItems.quantity),
			})
			.from(deliveryItems)
			.innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
			.innerJoin(distributionRuns, eq(deliveries.runId, distributionRuns.id))
			.where(runFilter)
			.groupBy(deliveryItems.productId),
	]);

	const totals = new Map<
		number,
		{ issued: number; delivered: number; verified: number }
	>();
	for (const row of issuedRows) {
		totals.set(row.productId, {
			issued: row.issued,
			delivered: 0,
			verified: row.verified,
		});
	}
	for (const row of deliveredRows) {
		const entry = totals.get(row.productId);
		if (entry) entry.delivered = row.delivered;
	}
	return totals;
}
