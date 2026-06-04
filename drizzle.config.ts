import { defineConfig } from "drizzle-kit";

// drizzle-kit 0.31 auto-loads .env via its built-in dotenv; DATABASE_URL_UNPOOLED
// lives in .env (placed by DAT-46). Only add `import "dotenv/config"` here if
// generate/migrate reports the variable as undefined.
//
// IMPORTANT: always use the DIRECT (unpooled) URL for migrations — never the
// PgBouncer pooled endpoint. Both live in .env / .env.local; they differ only
// by the `-pooler` host suffix.

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
