import { z } from "zod";

import { requestStatus } from "../schema.js";
import { productLinesSchema } from "./common.types.js";

export const listStockRequestsQuerySchema = z.object({
	status: z.enum(requestStatus.enumValues).optional(),
	warehouse: z.string().trim().min(1).optional(), // warehouse code
	fdoId: z.coerce.number().int().positive().optional(),
});

export const createStockRequestSchema = z.object({
	warehouseCode: z.string().trim().min(1),
	route: z.string().trim().min(1).optional(),
	plannedDate: z.iso.date().optional(),
	note: z.string().trim().min(1).optional(),
	products: productLinesSchema,
});

export const allocateStockRequestSchema = z.object({
	note: z.string().trim().min(1).optional(),
	products: z
		.array(
			z.object({
				productId: z.int().positive(),
				allocated: z.int().nonnegative(),
			}),
		)
		.min(1),
});

export const rejectStockRequestSchema = z.object({
	reason: z.string().trim().min(1),
});
