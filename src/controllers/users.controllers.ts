import { and, eq } from "drizzle-orm";
import express, { type Request, type Response } from "express";
import { z } from "zod";

import { db } from "../db.js";
import { userRole, users, warehouses } from "../schema.js";

const router = express.Router();

const listUsersQuerySchema = z.object({
	role: z.enum(userRole.enumValues).optional(),
	warehouse: z.string().trim().min(1).optional(), // home warehouse code
});

// Used for the FDO filters on the stock manager pages.
router.get("/users", async (req: Request, res: Response) => {
	const result = listUsersQuerySchema.safeParse(req.query);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}
	const { role, warehouse } = result.data;

	const rows = await db
		.select({
			id: users.id,
			firstName: users.firstName,
			lastName: users.lastName,
			email: users.email,
			role: users.role,
			homeWarehouse: {
				id: warehouses.id,
				code: warehouses.code,
				name: warehouses.name,
			},
		})
		.from(users)
		.leftJoin(warehouses, eq(users.homeWarehouseId, warehouses.id))
		.where(
			and(
				role ? eq(users.role, role) : undefined,
				warehouse ? eq(warehouses.code, warehouse) : undefined,
			),
		)
		.orderBy(users.firstName, users.lastName);

	res.json(rows);
});

export default router;
