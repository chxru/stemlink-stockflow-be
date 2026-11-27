import type { User } from "../schema.js";

// The custom claims we add to Clerk's session token
// (Clerk dashboard -> Sessions -> Customize session token):
//
// {
//   "role": "{{user.public_metadata.role}}",
//   "warehouse": "{{user.public_metadata.warehouse}}",
//   "email": "{{user.primary_email_address}}",
//   "firstName": "{{user.first_name}}",
//   "lastName": "{{user.last_name}}"
// }
//
// They arrive inside a token Clerk signed, so we can trust them. A claim can
// still be missing or null, so every value is `unknown` until we check it.
export type StockflowClaims = {
	role?: unknown;
	warehouse?: unknown;
	email?: unknown;
	firstName?: unknown;
	lastName?: unknown;
};

/** What we store about a user, taken from the claims. */
export type Profile = {
	role: User["role"];
	email: string;
	firstName: string;
	lastName: string;
	warehouseCode: string | null; // only FDOs have a home warehouse
};

/** Signed in with Clerk, but StockFlow can't let them in yet. */
export type AccessProblem = {
	problem: "missing-role" | "missing-warehouse" | "missing-profile";
	message: string;
};

export const isAccessProblem = (value: object): value is AccessProblem =>
	"problem" in value;

// The web app stores "stock-manager" in Clerk; the database enum says
// "stock_manager". Anything not listed here is not a StockFlow role.
const roleFromClerk: Record<string, User["role"]> = {
	"stock-manager": "stock_manager",
	fdo: "fdo",
};

// a non-empty, trimmed string, or null
const text = (value: unknown) =>
	typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/** Turn verified session claims into a StockFlow profile. No database here. */
export function profileFromClaims(
	claims: StockflowClaims,
): Profile | AccessProblem {
	const email = text(claims.email);
	if (!email) {
		return {
			problem: "missing-profile",
			message:
				"The session token has no email claim. Check the Clerk session token customization.",
		};
	}

	const clerkRole = text(claims.role);
	const role = clerkRole ? roleFromClerk[clerkRole] : undefined;
	if (!role) {
		return {
			problem: "missing-role",
			message: "Your account doesn't have a StockFlow role yet.",
		};
	}

	const warehouseCode = role === "fdo" ? text(claims.warehouse) : null;
	if (role === "fdo" && !warehouseCode) {
		return {
			problem: "missing-warehouse",
			message: "Your FDO account doesn't have a home warehouse yet.",
		};
	}

	return {
		role,
		email,
		// Clerk allows users without a name; the database doesn't
		firstName: text(claims.firstName) ?? email.split("@")[0] ?? email,
		lastName: text(claims.lastName) ?? "",
		warehouseCode,
	};
}
