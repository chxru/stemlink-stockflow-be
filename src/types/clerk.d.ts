// Tell TypeScript about the custom claims we added to Clerk's session token
// (see src/lib/claims.ts). getAuth(req).sessionClaims then knows these keys.
declare global {
	interface CustomJwtSessionClaims {
		role?: unknown;
		warehouse?: unknown;
		email?: unknown;
		firstName?: unknown;
		lastName?: unknown;
	}
}

export {};
