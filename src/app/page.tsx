import { LeadForm } from "./_components/lead-form";
import { supabaseServer } from "@/lib/supabase/server";
import { getBillingState, getCompletedTodayUTC } from "@/lib/billing/state";
import { FREE_DAILY_LIMIT } from "@/lib/billing/plans";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPro = false;
  let used = 0;
  if (user) {
    const [billing, today] = await Promise.all([
      getBillingState(supabase, user.id),
      getCompletedTodayUTC(supabase, user.id),
    ]);
    isPro = billing.isPro;
    used = today;
  }

  return (
    <main className="relative z-10 mx-auto max-w-[68rem] px-6 pb-32 pt-12 sm:px-10 sm:pt-16 lg:px-16">
      <header className="mb-16 flex items-baseline justify-between">
        <div className="font-display text-[1.375rem] leading-none tracking-tight">
          Lead<span className="italic"> Qualifier</span>
        </div>
        <div className="eyebrow hidden sm:block">BANT analyst · v0.1</div>
      </header>

      <section className="mb-12 grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.75rem,6.5vw,5rem)] leading-[0.95] tracking-tight">
            Qualify a lead.
            <span className="block italic text-[color:var(--muted)]">
              In sixty seconds.
            </span>
          </h1>
        </div>
        <div className="col-span-12 mt-6 md:col-span-3 md:mt-0">
          <p className="text-sm leading-relaxed text-[color:var(--muted)]">
            Drop in what you know about the company. We score it against
            Budget · Authority · Need · Timing and recommend a next move.
          </p>
        </div>
      </section>

      <hr className="mb-12 border-0 border-t border-[color:var(--rule)]" />

      <LeadForm isPro={isPro} usedToday={used} dailyLimit={FREE_DAILY_LIMIT} />

      <footer className="mt-32 flex items-center justify-between border-t border-[color:var(--rule)] pt-6">
        <div className="eyebrow">© Lead Qualifier</div>
        <div className="eyebrow">
          Powered by Trigger.dev · OpenRouter
        </div>
      </footer>
    </main>
  );
}
