import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

import { isAccessProblem } from "../lib/claims.js";
import { resolveCurrentUser } from "../lib/current-user.js";
import type { User } from "../schema.js";

/**
 * Who is calling? clerkMiddleware() (in server.ts) has already checked the
 * token's signature and expiry. Here we turn the verified Clerk session into
 * a StockFlow user and put it on req.user for the route handlers.
 *
 * Session 5 builds the "are they allowed?" checks on top of this.
 */
export async function attachUser(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const { isAuthenticated, userId, sessionClaims } = getAuth(req);
	if (!isAuthenticated) {
		// 401: we don't know who you are
		return res.status(401).json({ error: "Sign in to continue" });
	}

	const user = await resolveCurrentUser(userId, sessionClaims);
	if (isAccessProblem(user)) {
		// 403: we know who you are, but StockFlow can't let you in yet
		return res.status(403).json({ error: user.message });
	}

	req.user = user;
	next();
}

/** The signed-in user, in a route that runs after attachUser. */
export function currentUser(req: Request): User {
	if (!req.user) {
		throw new Error("attachUser must run before this route");
	}
	return req.user;
}
