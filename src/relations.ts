import { relations } from "drizzle-orm";

import {
	deliveries,
	deliveryItems,
	distributionRuns,
	outlets,
	products,
	runItems,
	stockRequestItems,
	stockRequests,
	users,
	warehouses,
} from "./schema.js";

// Relations tell Drizzle how tables link together, so `db.query.*` can load
// nested data with `with: { ... }`. They don't change the database (no
// migration): the foreign keys in schema.ts already do that.
//
// one(table, { fields, references }) = this row points to one row there
// many(table)                         = rows there point back to this row

export const stockRequestsRelations = relations(
	stockRequests,
	({ one, many }) => ({
		fdo: one(users, {
			fields: [stockRequests.fdoId],
			references: [users.id],
		}),
		decidedBy: one(users, {
			fields: [stockRequests.decidedById],
			references: [users.id],
		}),
		warehouse: one(warehouses, {
			fields: [stockRequests.warehouseId],
			references: [warehouses.id],
		}),
		items: many(stockRequestItems),
		// the run points at the request (distribution_runs.request_id)
		run: one(distributionRuns),
	}),
);

export const stockRequestItemsRelations = relations(
	stockRequestItems,
	({ one }) => ({
		request: one(stockRequests, {
			fields: [stockRequestItems.requestId],
			references: [stockRequests.id],
		}),
		product: one(products, {
			fields: [stockRequestItems.productId],
			references: [products.id],
		}),
	}),
);

export const distributionRunsRelations = relations(
	distributionRuns,
	({ one, many }) => ({
		request: one(stockRequests, {
			fields: [distributionRuns.requestId],
			references: [stockRequests.id],
		}),
		fdo: one(users, {
			fields: [distributionRuns.fdoId],
			references: [users.id],
		}),
		closedBy: one(users, {
			fields: [distributionRuns.closedById],
			references: [users.id],
		}),
		warehouse: one(warehouses, {
			fields: [distributionRuns.warehouseId],
			references: [warehouses.id],
		}),
		items: many(runItems),
		deliveries: many(deliveries),
	}),
);

export const runItemsRelations = relations(runItems, ({ one }) => ({
	run: one(distributionRuns, {
		fields: [runItems.runId],
		references: [distributionRuns.id],
	}),
	product: one(products, {
		fields: [runItems.productId],
		references: [products.id],
	}),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
	run: one(distributionRuns, {
		fields: [deliveries.runId],
		references: [distributionRuns.id],
	}),
	outlet: one(outlets, {
		fields: [deliveries.outletId],
		references: [outlets.id],
	}),
	items: many(deliveryItems),
}));

export const deliveryItemsRelations = relations(deliveryItems, ({ one }) => ({
	delivery: one(deliveries, {
		fields: [deliveryItems.deliveryId],
		references: [deliveries.id],
	}),
	product: one(products, {
		fields: [deliveryItems.productId],
		references: [products.id],
	}),
}));
