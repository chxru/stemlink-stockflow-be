import { eq } from "drizzle-orm";

import { db } from "../db.js";
import { warehouses } from "../schema.js";

export async function findWarehouseByCode(code: string) {
	const [warehouse] = await db
		.select()
		.from(warehouses)
		.where(eq(warehouses.code, code));
	return warehouse;
}
