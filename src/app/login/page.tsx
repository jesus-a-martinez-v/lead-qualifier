import { Suspense } from "react";
import { AuthForm } from "../_components/auth-forms";

export const metadata = { title: "Sign in — Lead Qualifier" };

export default function LoginPage() {
  return (
    <main className="relative z-10 mx-auto max-w-[68rem] px-6 pb-32 pt-12 sm:px-10 sm:pt-16 lg:px-16">
      <header className="mb-16 flex items-baseline justify-between">
        <div className="font-display text-[1.375rem] leading-none tracking-tight">
          Lead<span className="italic"> Qualifier</span>
        </div>
        <div className="eyebrow hidden sm:block">BANT analyst · v0.1</div>
      </header>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
