import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// App neon-http client over the POOLED connection string (DATABASE_URL).
// Used by Next.js server actions and pages (DAT-49 onward); imported by nothing yet.
// NOTE: drizzle-kit (generate/migrate) uses DATABASE_URL_UNPOOLED from drizzle.config.ts.

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
