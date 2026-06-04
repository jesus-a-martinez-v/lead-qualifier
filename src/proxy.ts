import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

// Lightweight Auth.js instance that only reads the JWT — no adapter, no bcrypt.
// auth.config.ts is edge/Node-safe; the full auth.ts (with DB + bcrypt) is NOT
// imported here to avoid bundling Node-only code into the proxy runtime.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth",         // Auth.js endpoints (signin callback, csrf, session)
  "/api/stripe/webhook",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some(
    (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`),
  );

  if (!req.auth && !isPublic) {
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "redirectTo",
      `${nextUrl.pathname}${nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, and the logout POST handler.
    "/((?!_next/static|_next/image|favicon.ico|logout).*)",
  ],
};
