"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/redirect";

const SignupSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  redirectTo: z.string().optional(),
});

export type SignupResult =
  | { error: string }
  | { success: true };

export async function signupAction(
  input: unknown,
): Promise<SignupResult> {
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const { email, password, redirectTo } = parsed.data;

  // Check for an existing account before hashing to avoid timing leaks on
  // non-existent users — acceptable trade-off for a simple credentials flow.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, hashedPassword });

  // signIn throws NEXT_REDIRECT on success — re-throw it so the redirect
  // actually happens. Only catch AuthError (bad credentials, etc.).
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirectPath(redirectTo),
    });
  } catch (e) {
    if (isRedirectError(e)) throw e; // let Next.js handle the redirect
    if (e instanceof AuthError) {
      return { error: "Account created but sign-in failed. Please log in." };
    }
    throw e;
  }

  return { success: true };
}
