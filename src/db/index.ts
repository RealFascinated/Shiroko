import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { schema } from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export { pool };
