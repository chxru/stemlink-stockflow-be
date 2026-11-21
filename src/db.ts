import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// biome-ignore lint/style/noNonNullAssertion: life is too short to worry about this rn
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

// logger: print every SQL query
export const db = drizzle({
	client,
	logger: true,
});
