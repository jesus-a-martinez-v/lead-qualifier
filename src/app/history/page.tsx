import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { LeadInput, QualificationResult } from "@/types/lead";

export const metadata = { title: "History — Lead Qualifier" };

type Row = {
  id: string;
  run_id: string | null;
  status: "pending" | "completed" | "failed";
  lead_input: LeadInput;
  result: QualificationResult | null;
  error: string | null;
  created_at: string;
};

const TIER_COLOR: Record<NonNullable<Row["result"]>["qualified_tier"], string> = {
  hot: "var(--ember)",
  warm: "var(--warm)",
  cold: "var(--cold)",
};

const TIER_LABEL: Record<NonNullable<Row["result"]>["qualified_tier"], string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const ACTION_LABEL: Record<
  NonNullable<Row["result"]>["recommended_action"],
  string
> = {
  call_now: "Call now",
  schedule_demo: "Schedule a demo",
  nurture_email: "Nurture by email",
  request_more_info: "Request more info",
  disqualify: "Disqualify",
};

export default async function HistoryPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/history");

  const { data, error } = await supabase
    .from("qualifications")
    .select("id, run_id, status, lead_input, result, error, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <main className="relative z-10 mx-auto max-w-[68rem] px-6 pb-32 pt-12 sm:px-10 sm:pt-16 lg:px-16">
      <section className="mb-12 grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.75rem,6.5vw,5rem)] leading-[0.95] tracking-tight">
            History.
            <span className="block italic text-[color:var(--muted)]">
              Every lead you&rsquo;ve scored.
            </span>
          </h1>
        </div>
        <div className="col-span-12 mt-6 md:col-span-3 md:mt-0">
          <p className="text-sm leading-relaxed text-[color:var(--muted)]">
            Most recent first. Only your own qualifications are visible — row-level
            security takes care of that.
          </p>
        </div>
      </section>

      <hr className="mb-12 border-0 border-t border-[color:var(--rule)]" />

      {error && (
        <p className="mb-12 border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--ember)]">
          {error.message}
        </p>
      )}

      {rows.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-[color:var(--muted)]">
            No qualifications yet.{" "}
            <Link href="/" className="text-[color:var(--ink)] underline-offset-4 hover:underline">
              Score your first lead →
            </Link>
          </p>
        </div>
      )}

      <ul className="divide-y divide-[color:var(--rule)]">
        {rows.map((row) => (
          <HistoryRow key={row.id} row={row} />
        ))}
      </ul>
    </main>
  );
}

function HistoryRow({ row }: { row: Row }) {
  const lead = row.lead_input;
  const created = new Date(row.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <li className="py-10">
      <div className="grid grid-cols-12 gap-x-8 gap-y-6">
        <div className="col-span-12 sm:col-span-4">
          <div className="eyebrow">{created}</div>
          <div className="mt-2 font-display text-2xl leading-tight">
            {lead.company}
          </div>
          <div className="text-sm text-[color:var(--muted)]">{lead.email}</div>
          {lead.role && (
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {lead.role}
              {lead.companySize ? ` · ${lead.companySize}` : ""}
            </div>
          )}
        </div>

        <div className="col-span-12 sm:col-span-8">
          {row.status === "pending" && <StatusBadge label="Pending" tone="muted" />}
          {row.status === "failed" && (
            <>
              <StatusBadge label="Failed" tone="ember" />
              {row.error && (
                <p className="mt-3 max-w-prose text-sm text-[color:var(--muted)]">
                  {row.error}
                </p>
              )}
            </>
          )}
          {row.status === "completed" && row.result && (
            <CompletedResult result={row.result} />
          )}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ember" | "muted";
}) {
  const color = tone === "ember" ? "var(--ember)" : "var(--muted)";
  return (
    <span
      className="inline-flex items-center gap-2 text-sm"
      style={{ color }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function CompletedResult({ result }: { result: QualificationResult }) {
  const tier = result.qualified_tier;
  const tierColor = TIER_COLOR[tier];

  return (
    <div>
      <div className="flex items-baseline gap-6">
        <div className="font-display text-5xl leading-none">
          {result.overall_score}
          <span className="text-2xl text-[color:var(--muted)]">/100</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: tierColor }}
            aria-hidden
          />
          <span
            className="font-display text-2xl leading-none"
            style={{ color: tierColor }}
          >
            {TIER_LABEL[tier]}
          </span>
        </div>
        <div className="text-sm text-[color:var(--muted)]">
          {ACTION_LABEL[result.recommended_action]}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {(["budget", "authority", "need", "timing"] as const).map((k) => (
          <div key={k}>
            <div className="eyebrow">{k}</div>
            <div className="font-display text-lg">
              {result.bant[k].score}
              <span className="text-sm text-[color:var(--muted)]">/5</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-prose text-sm leading-relaxed text-[color:var(--muted)]">
        {result.summary}
      </p>
    </div>
  );
}
