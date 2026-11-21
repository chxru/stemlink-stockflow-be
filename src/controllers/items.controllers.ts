import { randomUUID } from "node:crypto";

import express, { type Request, type Response } from "express";

import { categories, items } from "../data.js";
import {
	createItemSchema,
	type Item,
	updateItemSchema,
} from "../types/item.types.js";

const router = express.Router();

router.get("/items", (_req: Request, res: Response) => {
	res.json(items);
});

router.get("/items/:id", (req: Request, res: Response) => {
	const item = items.find((item) => item.id === req.params.id);
	if (!item) return res.status(404).json({ error: "Item not found" });
	res.json(item);
});

router.post("/items", (req: Request, res: Response) => {
	const result = createItemSchema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}
	const data = result.data;

	if (!categories.some((category) => category.id === data.categoryId)) {
		return res.status(400).json({ error: "Category does not exist" });
	}
	if (items.some((item) => item.sku === data.sku)) {
		return res.status(409).json({ error: "SKU already exists" });
	}

	const item: Item = { id: randomUUID(), ...data };
	items.push(item);
	res.status(201).json(item);
});

router.patch("/items/:id", (req: Request, res: Response) => {
	const item = items.find((item) => item.id === req.params.id);
	if (!item) return res.status(404).json({ error: "Item not found" });

	const result = updateItemSchema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}
	const changes = result.data;

	if (
		changes.categoryId &&
		!categories.some((category) => category.id === changes.categoryId)
	) {
		return res.status(400).json({ error: "Category does not exist" });
	}
	if (items.some((other) => other.sku === changes.sku && other !== item)) {
		return res.status(409).json({ error: "SKU already exists" });
	}

	Object.assign(item, changes);
	res.json(item);
});

router.delete("/items/:id", (req: Request, res: Response) => {
	const index = items.findIndex((item) => item.id === req.params.id);
	if (index === -1) return res.status(404).json({ error: "Item not found" });

	const [deleted] = items.splice(index, 1);
	res.json(deleted);
});

export default router;
