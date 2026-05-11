import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getBillingState, getCompletedTodayUTC } from "@/lib/billing/state";
import { FREE_DAILY_LIMIT, PRO_PRICE_USD } from "@/lib/billing/plans";
import { UpgradeButton, ManageButton } from "./_components/billing-buttons";

type SearchParams = Promise<{ upgraded?: string }>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { upgraded } = await searchParams;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/billing");

  const [{ isPro, subscription }, used] = await Promise.all([
    getBillingState(supabase, user.id),
    getCompletedTodayUTC(supabase, user.id),
  ]);

  return (
    <main className="relative z-10 mx-auto max-w-[68rem] px-6 pb-32 pt-12 sm:px-10 sm:pt-16 lg:px-16">
      <header className="mb-16 flex items-baseline justify-between">
        <div className="font-display text-[1.375rem] leading-none tracking-tight">
          Lead<span className="italic"> Qualifier</span>
        </div>
        <div className="eyebrow hidden sm:block">Billing</div>
      </header>

      <section className="mb-12 grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.75rem,6.5vw,5rem)] leading-[0.95] tracking-tight">
            {isPro ? "You're on Pro." : "Pick a plan."}
            <span className="block italic text-[color:var(--muted)]">
              {isPro ? "Unlimited qualifications." : `Free includes ${FREE_DAILY_LIMIT}/day.`}
            </span>
          </h1>
        </div>
      </section>

      <hr className="mb-12 border-0 border-t border-[color:var(--rule)]" />

      {upgraded === "1" && !isPro && (
        <div className="mb-12 border-l-2 border-[color:var(--muted)] pl-4 text-sm text-[color:var(--muted)]">
          Payment received — your subscription should activate within a few seconds. Refresh this
          page if you don't see Pro shortly.
        </div>
      )}

      {upgraded === "1" && isPro && (
        <div className="mb-12 border-l-2 border-emerald-500 pl-4 text-sm text-emerald-700 dark:text-emerald-400">
          You're now on Pro — unlimited qualifications unlocked.
        </div>
      )}

      <div className="grid grid-cols-12 gap-x-8 gap-y-12">
        <div className="col-span-12 md:col-span-6">
          <div className="eyebrow mb-3">Free</div>
          <div className="font-display text-4xl leading-none">$0</div>
          <ul className="mt-6 space-y-2 text-sm text-[color:var(--muted)]">
            <li>{FREE_DAILY_LIMIT} qualifications per day (UTC reset)</li>
            <li>Failed runs don't count toward your limit</li>
            <li>Full history of every result</li>
          </ul>
          {!isPro && (
            <p className="mt-6 text-sm">
              <strong>{used}</strong> / {FREE_DAILY_LIMIT} used today.
            </p>
          )}
        </div>

        <div className="col-span-12 md:col-span-6">
          <div className="eyebrow mb-3">Pro</div>
          <div className="font-display text-4xl leading-none">
            ${PRO_PRICE_USD}
            <span className="text-base text-[color:var(--muted)]"> / month</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm text-[color:var(--muted)]">
            <li>Unlimited qualifications</li>
            <li>Priority queue (planned)</li>
            <li>Cancel anytime from the customer portal</li>
          </ul>

          <div className="mt-8">
            {isPro && subscription ? (
              <ProDetails
                periodEnd={subscription.current_period_end}
                cancelAtPeriodEnd={subscription.cancel_at_period_end}
              />
            ) : (
              <UpgradeButton label={`Upgrade — $${PRO_PRICE_USD} / mo`} />
            )}
          </div>
        </div>
      </div>

      <footer className="mt-32 flex items-center justify-between border-t border-[color:var(--rule)] pt-6">
        <div className="eyebrow">© Lead Qualifier</div>
        <div className="eyebrow">Billing powered by Stripe</div>
      </footer>
    </main>
  );
}

function ProDetails({
  periodEnd,
  cancelAtPeriodEnd,
}: {
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--muted)]">
        {cancelAtPeriodEnd
          ? `Cancels on ${formatDate(periodEnd)} — you keep Pro access until then.`
          : `Renews on ${formatDate(periodEnd)}.`}
      </p>
      <ManageButton />
    </div>
  );
}
