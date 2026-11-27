import { z } from "zod";

import { runStatus } from "../schema.js";
import { productLinesSchema } from "./common.types.js";

export const listRunsQuerySchema = z.object({
	status: z.enum(runStatus.enumValues).optional(),
	warehouse: z.string().trim().min(1).optional(), // warehouse code
	fdoId: z.coerce.number().int().positive().optional(),
});

export const recordDeliverySchema = z.object({
	outletId: z.int().positive(),
	note: z.string().trim().min(1).optional(),
	products: productLinesSchema,
});

export const submitReturnSchema = z.object({
	note: z.string().trim().min(1).optional(),
	products: z
		.array(
			z.object({
				productId: z.int().positive(),
				declaredReturn: z.int().nonnegative(),
			}),
		)
		.min(1),
});

export const requestRevisionSchema = z.object({
	feedback: z.string().trim().min(1),
});

export const acceptReturnSchema = z.object({
	note: z.string().trim().min(1).optional(),
	products: z
		.array(
			z.object({
				productId: z.int().positive(),
				verifiedReturn: z.int().nonnegative(),
			}),
		)
		.min(1),
});
