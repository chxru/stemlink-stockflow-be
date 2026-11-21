import { randomUUID } from "node:crypto";

import express, { type Request, type Response } from "express";

import { categories, items } from "../data.js";
import { type Category, createCategorySchema } from "../types/item.types.js";

const router = express.Router();

router.get("/categories", (_req: Request, res: Response) => {
	res.json(categories);
});

router.get("/categories/:id", (req: Request, res: Response) => {
	const category = categories.find((category) => category.id === req.params.id);
	if (!category) return res.status(404).json({ error: "Category not found" });
	res.json(category);
});

router.post("/categories", (req: Request, res: Response) => {
	const result = createCategorySchema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}

	const category: Category = { id: randomUUID(), ...result.data };
	categories.push(category);
	res.status(201).json(category);
});

router.delete("/categories/:id", (req: Request, res: Response) => {
	const index = categories.findIndex(
		(category) => category.id === req.params.id,
	);
	if (index === -1) {
		return res.status(404).json({ error: "Category not found" });
	}
	// Like onDelete: "restrict": can't delete a category that still has items.
	if (items.some((item) => item.categoryId === req.params.id)) {
		return res.status(409).json({ error: "Category still has items" });
	}

	const [deleted] = categories.splice(index, 1);
	res.json(deleted);
});

export default router;
