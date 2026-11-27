import { z } from "zod";

export const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export const productQuantitySchema = z.object({
	productId: z.int().positive(),
	quantity: z.int().positive(),
});

// At least one line, and no product listed twice.
export const productLinesSchema = z
	.array(productQuantitySchema)
	.min(1)
	.refine(
		(lines) =>
			new Set(lines.map((line) => line.productId)).size === lines.length,
		"Each product can only appear once",
	);
