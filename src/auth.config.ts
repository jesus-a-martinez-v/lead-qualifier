import type { NextAuthConfig } from "next-auth";

// Edge-safe config object — no database adapter, no bcrypt, no Node-only imports.
// The Credentials provider (which needs bcrypt + DB) is added in auth.ts.
// Imported by proxy.ts to build a lightweight instance for JWT verification.
export default {
  providers: [],
  pages: { signIn: "/login" },
  trustHost: true, // required for self-hosting / local dev (no canonical AUTH_URL needed)
} satisfies NextAuthConfig;
