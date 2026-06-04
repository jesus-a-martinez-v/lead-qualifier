import Link from "next/link";
import { auth } from "@/auth";

export async function AuthHeader() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="border-b border-[color:var(--rule)]">
      <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-3 text-sm sm:px-10 lg:px-16">
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="font-display text-base leading-none tracking-tight"
          >
            Lead<span className="italic"> Qualifier</span>
          </Link>
          <Link
            href="/history"
            className="text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--ink)] hover:underline"
          >
            History
          </Link>
          <Link
            href="/billing"
            className="text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--ink)] hover:underline"
          >
            Billing
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="hidden text-[color:var(--muted)] sm:inline">
            {session.user.email}
          </span>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--ember)] hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
