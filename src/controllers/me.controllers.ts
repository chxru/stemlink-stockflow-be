import { eq } from "drizzle-orm";
import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { attachUser, currentUser } from "../middlewares/attach-user.js";
import { warehouses } from "../schema.js";

const router = express.Router();

// The signed-in user. The first endpoint that knows who is calling.
router.get("/me", attachUser, async (req: Request, res: Response) => {
	const user = currentUser(req);

	const [homeWarehouse] = user.homeWarehouseId
		? await db
				.select({
					id: warehouses.id,
					code: warehouses.code,
					name: warehouses.name,
				})
				.from(warehouses)
				.where(eq(warehouses.id, user.homeWarehouseId))
		: [];

	res.json({
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
		role: user.role,
		homeWarehouse: homeWarehouse ?? null,
	});
});

export default router;
