import type { DefaultSession } from "next-auth";

// Augment the built-in types so session.user.id and token.id typecheck
// under strict mode without casts at every call-site.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
