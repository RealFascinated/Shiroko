import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export { pool };

/** The database handle type used for both top-level calls and transactions. */
export type DbClient = NodePgDatabase<typeof schema>;
