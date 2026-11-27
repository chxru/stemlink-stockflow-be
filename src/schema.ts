import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// See README.md for the ER diagram and the reasoning behind this schema.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["stock_manager", "fdo"]);

export const requestStatus = pgEnum("request_status", [
	"pending",
	"allocation_ready",
	"approved",
	"rejected",
]);

export const runStatus = pgEnum("run_status", [
	"awaiting_collection",
	"in_progress",
	"return_submitted",
	"revision_requested",
	"closed",
]);

export const movementType = pgEnum("movement_type", [
	"receipt",
	"issue",
	"return",
]);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const warehouses = pgTable("warehouses", {
	id: id(),
	code: text("code").notNull().unique(),
	name: text("name").notNull(),
	createdAt: createdAt(),
});

export const products = pgTable(
	"products",
	{
		id: id(),
		sku: text("sku").notNull().unique(),
		name: text("name").notNull(),
		reorderLevel: integer("reorder_level").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: createdAt(),
	},
	(t) => [check("products_reorder_level_check", sql`${t.reorderLevel} >= 0`)],
);

export const users = pgTable(
	"users",
	{
		id: id(),
		clerkUserId: text("clerk_user_id").notNull().unique(),
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		email: text("email").notNull().unique(),
		role: userRole("role").notNull(),
		homeWarehouseId: integer("home_warehouse_id").references(
			() => warehouses.id,
			{ onDelete: "restrict" },
		),
		createdAt: createdAt(),
	},
	(t) => [
		// BR 20: every FDO belongs to a home warehouse.
		check(
			"users_fdo_home_warehouse_check",
			sql`${t.role} <> 'fdo' OR ${t.homeWarehouseId} IS NOT NULL`,
		),
	],
);

export const outlets = pgTable("outlets", {
	id: id(),
	name: text("name").notNull(),
	area: text("area").notNull(),
	createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Stock issue: request -> allocation -> acceptance
// ---------------------------------------------------------------------------

export const stockRequests = pgTable(
	"stock_requests",
	{
		id: id(),
		fdoId: integer("fdo_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		warehouseId: integer("warehouse_id")
			.notNull()
			.references(() => warehouses.id, { onDelete: "restrict" }),
		status: requestStatus("status").notNull().default("pending"),
		route: text("route"),
		plannedDate: date("planned_date"),
		requestNote: text("request_note"),
		requestedAt: timestamp("requested_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		decidedById: integer("decided_by_id").references(() => users.id, {
			onDelete: "restrict",
		}),
		allocatedAt: timestamp("allocated_at", { withTimezone: true }),
		allocationNote: text("allocation_note"),
		rejectedAt: timestamp("rejected_at", { withTimezone: true }),
		rejectionReason: text("rejection_reason"),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	},
	(t) => [
		index("stock_requests_fdo_id_idx").on(t.fdoId),
		index("stock_requests_warehouse_id_status_idx").on(t.warehouseId, t.status),
	],
);

export const stockRequestItems = pgTable(
	"stock_request_items",
	{
		requestId: integer("request_id")
			.notNull()
			.references(() => stockRequests.id, { onDelete: "cascade" }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "restrict" }),
		requestedQty: integer("requested_qty").notNull(),
		allocatedQty: integer("allocated_qty"),
	},
	(t) => [
		primaryKey({ columns: [t.requestId, t.productId] }),
		check(
			"stock_request_items_requested_qty_check",
			sql`${t.requestedQty} > 0`,
		),
		check(
			"stock_request_items_allocated_qty_check",
			sql`${t.allocatedQty} >= 0`,
		),
	],
);

// ---------------------------------------------------------------------------
// Distribution: run -> deliveries -> return
// ---------------------------------------------------------------------------

export const distributionRuns = pgTable(
	"distribution_runs",
	{
		id: id(),
		requestId: integer("request_id")
			.notNull()
			.unique()
			.references(() => stockRequests.id, { onDelete: "restrict" }),
		fdoId: integer("fdo_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		warehouseId: integer("warehouse_id")
			.notNull()
			.references(() => warehouses.id, { onDelete: "restrict" }),
		status: runStatus("status").notNull().default("awaiting_collection"),
		createdAt: createdAt(),
		collectedAt: timestamp("collected_at", { withTimezone: true }),
		returnSubmittedAt: timestamp("return_submitted_at", { withTimezone: true }),
		returnNote: text("return_note"),
		revisionFeedback: text("revision_feedback"),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		closedById: integer("closed_by_id").references(() => users.id, {
			onDelete: "restrict",
		}),
		verificationNote: text("verification_note"),
	},
	(t) => [
		uniqueIndex("distribution_runs_one_open_run_per_fdo_idx")
			.on(t.fdoId)
			.where(sql`${t.status} <> 'closed'`),
		index("distribution_runs_warehouse_id_status_idx").on(
			t.warehouseId,
			t.status,
		),
	],
);

export const runItems = pgTable(
	"run_items",
	{
		runId: integer("run_id")
			.notNull()
			.references(() => distributionRuns.id, { onDelete: "cascade" }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "restrict" }),
		issuedQty: integer("issued_qty").notNull(),
		declaredReturnQty: integer("declared_return_qty"),
		verifiedReturnQty: integer("verified_return_qty"),
	},
	(t) => [
		primaryKey({ columns: [t.runId, t.productId] }),
		check("run_items_issued_qty_check", sql`${t.issuedQty} > 0`),
		check(
			"run_items_declared_return_qty_check",
			sql`${t.declaredReturnQty} >= 0`,
		),
		check(
			"run_items_verified_return_qty_check",
			sql`${t.verifiedReturnQty} >= 0`,
		),
	],
);

export const deliveries = pgTable(
	"deliveries",
	{
		id: id(),
		runId: integer("run_id")
			.notNull()
			.references(() => distributionRuns.id, { onDelete: "cascade" }),
		outletId: integer("outlet_id")
			.notNull()
			.references(() => outlets.id, { onDelete: "restrict" }),
		deliveredAt: timestamp("delivered_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		note: text("note"),
	},
	(t) => [index("deliveries_run_id_idx").on(t.runId)],
);

export const deliveryItems = pgTable(
	"delivery_items",
	{
		deliveryId: integer("delivery_id")
			.notNull()
			.references(() => deliveries.id, { onDelete: "cascade" }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "restrict" }),
		quantity: integer("quantity").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.deliveryId, t.productId] }),
		check("delivery_items_quantity_check", sql`${t.quantity} > 0`),
	],
);

// ---------------------------------------------------------------------------
// Stock ledger: the only source of warehouse stock levels
// ---------------------------------------------------------------------------

export const stockMovements = pgTable(
	"stock_movements",
	{
		id: id(),
		warehouseId: integer("warehouse_id")
			.notNull()
			.references(() => warehouses.id, { onDelete: "restrict" }),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "restrict" }),
		type: movementType("type").notNull(),
		// Signed: positive = into the warehouse, negative = out of it.
		quantity: integer("quantity").notNull(),
		runId: integer("run_id").references(() => distributionRuns.id, {
			onDelete: "restrict",
		}),
		reference: text("reference"),
		createdById: integer("created_by_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: createdAt(),
	},
	(t) => [
		index("stock_movements_warehouse_id_product_id_idx").on(
			t.warehouseId,
			t.productId,
		),
		index("stock_movements_run_id_idx").on(t.runId),
		// receipts and returns add stock, issues remove it.
		check(
			"stock_movements_quantity_sign_check",
			sql`(${t.type} = 'issue' AND ${t.quantity} < 0) OR (${t.type} <> 'issue' AND ${t.quantity} > 0)`,
		),
		// issues and returns always belong to a run, receipts never do.
		check(
			"stock_movements_run_id_check",
			sql`(${t.type} = 'receipt') = (${t.runId} IS NULL)`,
		),
	],
);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type Warehouse = typeof warehouses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type User = typeof users.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type StockRequest = typeof stockRequests.$inferSelect;
export type StockRequestItem = typeof stockRequestItems.$inferSelect;
export type DistributionRun = typeof distributionRuns.$inferSelect;
export type RunItem = typeof runItems.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryItem = typeof deliveryItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
