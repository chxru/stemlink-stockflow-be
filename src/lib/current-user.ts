import { eq } from "drizzle-orm";

import { db } from "../db.js";
import { type User, users } from "../schema.js";
import {
	type AccessProblem,
	isAccessProblem,
	profileFromClaims,
	type StockflowClaims,
} from "./claims.js";
import { findWarehouseByCode } from "./warehouses.js";

/**
 * Find the StockFlow user behind a verified Clerk session, creating the row on
 * their first request ("just-in-time provisioning").
 *
 * Clerk owns the identity (sign-in, password, email). Our users table owns the
 * StockFlow side: every request, run and stock movement points at users.id.
 * users.clerk_user_id (UNIQUE) is the 1:1 link between the two.
 */
export async function resolveCurrentUser(
	clerkUserId: string,
	claims: StockflowClaims,
): Promise<User | AccessProblem> {
	const profile = profileFromClaims(claims);
	if (isAccessProblem(profile)) return profile;

	let homeWarehouseId: number | null = null;
	if (profile.warehouseCode) {
		const warehouse = await findWarehouseByCode(profile.warehouseCode);
		if (!warehouse) {
			return {
				problem: "missing-warehouse",
				message: `Your home warehouse ${profile.warehouseCode} doesn't exist in StockFlow.`,
			};
		}
		homeWarehouseId = warehouse.id;
	}

	const values = {
		email: profile.email,
		firstName: profile.firstName,
		lastName: profile.lastName,
		role: profile.role,
		homeWarehouseId,
	};

	// The usual case: the row exists and nothing changed, so no write.
	const existing = await db.query.users.findFirst({
		where: eq(users.clerkUserId, clerkUserId),
	});
	if (existing && isUpToDate(existing, values)) return existing;

	// First request, or the role/warehouse/name changed in Clerk.
	// ON CONFLICT also covers two first requests arriving at the same time.
	const [user] = await db
		.insert(users)
		.values({ clerkUserId, ...values })
		.onConflictDoUpdate({ target: users.clerkUserId, set: values })
		.returning();

	if (!user) throw new Error(`Couldn't save user ${clerkUserId}`);
	return user;
}

function isUpToDate(
	user: User,
	values: Omit<User, "id" | "clerkUserId" | "createdAt">,
) {
	return (
		user.email === values.email &&
		user.firstName === values.firstName &&
		user.lastName === values.lastName &&
		user.role === values.role &&
		user.homeWarehouseId === values.homeWarehouseId
	);
}
