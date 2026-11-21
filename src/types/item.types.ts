import { z } from "zod";

export const createCategorySchema = z.object({
	name: z.string().trim().min(1),
});

export const createItemSchema = z.object({
	sku: z.string().trim().min(1),
	name: z.string().trim().min(1),
	categoryId: z.string(),
	quantityOnHand: z.int().nonnegative().default(0),
	reorderLevel: z.int().nonnegative().default(0),
});

export const updateItemSchema = createItemSchema.partial();

export type Category = z.infer<typeof createCategorySchema> & { id: string };
export type Item = z.infer<typeof createItemSchema> & { id: string };
