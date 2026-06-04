// Worker-only Drizzle client — uses a module-level pg Pool for long-running
// Trigger.dev tasks. Do NOT import this file from any Next.js app code;
// use src/lib/db/index.ts (neon-http) there instead.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
