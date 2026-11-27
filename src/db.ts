import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as relations from "./relations.js";
import * as tables from "./schema.js";

// biome-ignore lint/style/noNonNullAssertion: life is too short to worry about this rn
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

// logger: print every SQL query
// schema: tables + relations, which enables `db.query.*` (relational queries)
export const db = drizzle({
	client,
	schema: { ...tables, ...relations },
	logger: true,
});
