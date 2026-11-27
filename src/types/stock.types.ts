import { z } from "zod";

export const stockSummaryQuerySchema = z.object({
	// "all" or a warehouse code such as WH-1
	warehouse: z.string().trim().min(1).default("all"),
	// YYYY-MM, defaults to the current month
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM")
		.default(() => new Date().toISOString().slice(0, 7)),
});

export const createStockReceiptSchema = z.object({
	warehouseCode: z.string().trim().min(1),
	sku: z.string().trim().min(1),
	quantity: z.int().positive(),
	reference: z.string().trim().min(1).optional(),
});
