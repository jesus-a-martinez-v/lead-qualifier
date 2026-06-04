import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { qualifications } from "@/lib/db/schema";
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
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirectTo=/history");

  let rows: Row[] = [];
  let fetchError: string | null = null;

  try {
    const dbRows = await db
      .select({
        id: qualifications.id,
        runId: qualifications.runId,
        status: qualifications.status,
        leadInput: qualifications.leadInput,
        result: qualifications.result,
        error: qualifications.error,
        createdAt: qualifications.createdAt,
      })
      .from(qualifications)
      // Per-user filter — required now that RLS is gone. Without this every
      // user would see every row. This is the #1 correctness gate.
      .where(eq(qualifications.userId, session.user.id))
      .orderBy(desc(qualifications.createdAt));

    rows = dbRows.map((r) => ({
      id: r.id,
      run_id: r.runId,
      status: r.status as Row["status"],
      lead_input: r.leadInput as LeadInput,
      result: r.result as QualificationResult | null,
      error: r.error,
      created_at: r.createdAt.toISOString(),
    }));
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

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
            Most recent first. Only your own qualifications are visible —
            scoped to your account.
          </p>
        </div>
      </section>

      <hr className="mb-12 border-0 border-t border-[color:var(--rule)]" />

      {fetchError && (
        <p className="mb-12 border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--ember)]">
          {fetchError}
        </p>
      )}

      {rows.length === 0 && !fetchError && (
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

const BANT_LABEL = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timing: "Timing",
} as const;

function HistoryRow({ row }: { row: Row }) {
  const created = new Date(row.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (row.status === "completed" && row.result) {
    return (
      <li className="py-2">
        <details className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none py-8 outline-none">
            <Header row={row} created={created} preview />
          </summary>
          <div className="pb-10 pt-2">
            <ExpandedResult result={row.result} lead={row.lead_input} />
          </div>
        </details>
      </li>
    );
  }

  return (
    <li className="py-10">
      <Header row={row} created={created} preview={false} />
      {row.status === "failed" && row.error && (
        <p className="mt-4 max-w-prose border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--muted)]">
          {row.error}
        </p>
      )}
    </li>
  );
}

function Header({
  row,
  created,
  preview,
}: {
  row: Row;
  created: string;
  preview: boolean;
}) {
  const lead = row.lead_input;

  return (
    <div className="grid grid-cols-12 items-start gap-x-8 gap-y-4">
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
        {row.status === "failed" && <StatusBadge label="Failed" tone="ember" />}
        {row.status === "completed" && row.result && (
          <CompletedSummary result={row.result} preview={preview} />
        )}
      </div>
    </div>
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
    <span className="inline-flex items-center gap-2 text-sm" style={{ color }}>
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function CompletedSummary({
  result,
  preview,
}: {
  result: QualificationResult;
  preview: boolean;
}) {
  const tier = result.qualified_tier;
  const tierColor = TIER_COLOR[tier];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
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
        {preview && (
          <span className="eyebrow ml-auto text-[color:var(--muted)] group-open:hidden">
            Click to expand →
          </span>
        )}
        {preview && (
          <span className="eyebrow ml-auto hidden text-[color:var(--muted)] group-open:inline">
            Collapse ↑
          </span>
        )}
      </div>
    </div>
  );
}

function ExpandedResult({
  result,
  lead,
}: {
  result: QualificationResult;
  lead: Row["lead_input"];
}) {
  return (
    <div className="grid grid-cols-12 gap-x-8 gap-y-10">
      <div className="col-span-12 sm:col-span-8">
        <hr className="mb-8 border-0 border-t border-[color:var(--rule)]" />

        <div className="grid grid-cols-1 sm:grid-cols-2">
          {(["budget", "authority", "need", "timing"] as const).map((key, i) => {
            const cell = result.bant[key];
            const isRight = i % 2 === 1;
            const isBottom = i >= 2;
            return (
              <div
                key={key}
                className={[
                  "py-6 sm:py-8",
                  isRight ? "sm:pl-8" : "sm:pr-8",
                  !isBottom ? "border-b border-[color:var(--rule)]" : "",
                  isRight ? "sm:border-l border-[color:var(--rule)]" : "",
                ].join(" ")}
              >
                <div className="eyebrow">{BANT_LABEL[key]}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-3xl leading-none">
                    {cell.score}
                  </span>
                  <span className="font-display text-lg leading-none text-[color:var(--muted)]">
                    / 5
                  </span>
                </div>
                <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-[color:var(--muted)]">
                  {cell.reasoning}
                </p>
              </div>
            );
          })}
        </div>

        <hr className="my-8 border-0 border-t border-[color:var(--rule)]" />

        <div className="grid grid-cols-12 gap-x-8">
          <div className="col-span-12 sm:col-span-3">
            <div className="eyebrow">— Summary</div>
          </div>
          <div className="col-span-12 mt-2 sm:col-span-9 sm:mt-0">
            <p className="font-display text-[1.25rem] leading-snug">
              {result.summary}
            </p>
          </div>
        </div>
      </div>

      <aside className="col-span-12 sm:col-span-4">
        <hr className="mb-8 border-0 border-t border-[color:var(--rule)]" />
        <div className="eyebrow mb-4">Lead input</div>
        <dl className="space-y-3 text-sm">
          {lead.fullName && <LeadField label="Full name" value={lead.fullName} />}
          {lead.website && <LeadField label="Website" value={lead.website} />}
          {lead.industry && <LeadField label="Industry" value={lead.industry} />}
          {lead.source && <LeadField label="Source" value={lead.source} />}
          {lead.companySize && (
            <LeadField label="Company size" value={lead.companySize} />
          )}
          {lead.model && <LeadField label="Model" value={lead.model} />}
          {lead.notes && (
            <div>
              <dt className="field-label">SDR notes</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-[color:var(--muted)]">
                {lead.notes}
              </dd>
            </div>
          )}
        </dl>
      </aside>
    </div>
  );
}

function LeadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="field-label">{label}</dt>
      <dd className="truncate text-right text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}
