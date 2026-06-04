"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { safeRedirectPath } from "@/lib/redirect";
import { signupAction } from "@/app/actions/auth";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirectPath(params.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "login") {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Invalid email or password.");
          return;
        }
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // Signup — server action handles user creation + auto sign-in + redirect.
      const result = await signupAction({ email, password, redirectTo });
      if (result && "error" in result) {
        setError(result.error);
      }
      // On success, signupAction throws NEXT_REDIRECT — nothing more to do here.
    });
  };

  const title = mode === "login" ? "Sign in." : "Create account.";
  const cta = mode === "login" ? "Sign in" : "Sign up";
  const altHref = mode === "login" ? "/signup" : "/login";
  const altLabel = mode === "login" ? "Need an account?" : "Have an account?";

  return (
    <section className="grid grid-cols-12 gap-x-6">
      <div className="col-span-12 md:col-span-7">
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.98] tracking-tight">
          {title}
          <span className="block italic text-[color:var(--muted)]">
            {mode === "login" ? "Welcome back." : "It only takes a moment."}
          </span>
        </h1>

        <form onSubmit={onSubmit} noValidate className="mt-12 max-w-md">
          <div className="grid grid-cols-1 gap-y-8">
            <div>
              <label htmlFor="email" className="field-label mb-1 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label mb-1 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={altHref}
              className="text-sm text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--ink)] hover:underline"
            >
              {altLabel}
            </Link>
            <button type="submit" className="cta" disabled={pending}>
              {pending ? "Working…" : cta}
              <span className="cta__arrow" aria-hidden>
                →
              </span>
            </button>
          </div>

          {error && (
            <p className="mt-6 border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--ember)]">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
