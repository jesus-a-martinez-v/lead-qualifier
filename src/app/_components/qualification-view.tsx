"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { qualifyLeadTask } from "@/trigger/qualify-lead";
import type { QualificationResult } from "@/types/lead";

type Props = {
  runId: string;
  publicAccessToken: string;
};

const STAGES = [
  { key: "validating", label: "Validating" },
  { key: "calling_llm", label: "Reasoning" },
  { key: "parsing_result", label: "Parsing" },
  { key: "complete", label: "Done" },
] as const;

const TIER_LABEL: Record<QualificationResult["qualified_tier"], string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const TIER_COLOR: Record<QualificationResult["qualified_tier"], string> = {
  hot: "var(--ember)",
  warm: "var(--warm)",
  cold: "var(--cold)",
};

const ACTION_LABEL: Record<QualificationResult["recommended_action"], string> = {
  call_now: "Call now",
  schedule_demo: "Schedule a demo",
  nurture_email: "Nurture by email",
  request_more_info: "Request more info",
  disqualify: "Disqualify",
};

const BANT_ORDER = ["budget", "authority", "need", "timing"] as const;
const BANT_LABEL: Record<(typeof BANT_ORDER)[number], string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timing: "Timing",
};

export function QualificationView({ runId, publicAccessToken }: Props) {
  const { run, error } = useRealtimeRun<typeof qualifyLeadTask>(runId, {
    accessToken: publicAccessToken,
  });

  if (error) {
    return <ErrorBlock message={error.message} />;
  }

  if (!run) {
    return <Stage activeKey="validating" runId={runId} />;
  }

  const statusFromMetadata = (run.metadata?.status as string | undefined) ?? "validating";
  const model = (run.metadata?.model as string | undefined) ?? null;

  if (run.isFailed || run.status === "CRASHED" || run.status === "SYSTEM_FAILURE" || run.status === "TIMED_OUT" || run.status === "EXPIRED") {
    return (
      <ErrorBlock
        message={run.error?.message ?? "The qualification run failed."}
        runId={runId}
      />
    );
  }

  if (run.isCancelled) {
    return <ErrorBlock message="The qualification run was canceled." runId={runId} />;
  }

  if (!run.isCompleted) {
    return <Stage activeKey={statusFromMetadata} runId={runId} model={model} />;
  }

  const output = run.output;
  if (!output) {
    return <Stage activeKey="parsing_result" runId={runId} model={model} />;
  }

  if (output.status === "error") {
    return (
      <ErrorBlock
        message={`${output.stage}: ${output.error}`}
        runId={runId}
      />
    );
  }

  return <ResultCard result={output.result} runId={runId} model={model} />;
}

function Stage({
  activeKey,
  runId,
  model,
}: {
  activeKey: string;
  runId: string;
  model?: string | null;
}) {
  return (
    <section aria-live="polite">
      <div className="eyebrow mb-6">Live · run {runId.slice(0, 10)}…</div>
      <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
        Analyzing the lead{model ? " " : "…"}
        {model && <span className="italic text-[color:var(--muted)]">via {model}</span>}
      </h2>
      <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-4">
        {STAGES.map((stage, i) => {
          const activeIdx = STAGES.findIndex((s) => s.key === activeKey);
          const isActive = stage.key === activeKey;
          const isDone = i < activeIdx;
          return (
            <li
              key={stage.key}
              className={
                isActive ? "step-active" : isDone ? "opacity-60" : "opacity-30"
              }
            >
              <div className="eyebrow">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-2 font-display text-xl">{stage.label}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ResultCard({
  result,
  runId,
  model,
}: {
  result: QualificationResult;
  runId: string;
  model?: string | null;
}) {
  const tier = result.qualified_tier;
  const tierColor = TIER_COLOR[tier];

  return (
    <section aria-live="polite" className="rise">
      <div className="eyebrow mb-6">
        Result · run {runId.slice(0, 10)}…
        {model ? <span className="ml-3 text-[color:var(--muted)]">{model}</span> : null}
      </div>

      {/* Top row: huge score on left, tier + action on right */}
      <div className="rise rise-delay-1 grid grid-cols-12 items-end gap-x-8 gap-y-10">
        <div className="col-span-12 sm:col-span-7">
          <ScoreNumber score={result.overall_score} tierColor={tierColor} />
        </div>
        <div className="col-span-12 flex flex-col gap-3 sm:col-span-5 sm:items-end sm:text-right">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: tierColor }}
              aria-hidden
            />
            <span
              className="font-display text-3xl leading-none"
              style={{ color: tierColor }}
            >
              {TIER_LABEL[tier]}
            </span>
          </div>
          <div>
            <div className="eyebrow mb-1">Recommended</div>
            <div className="font-display text-2xl italic leading-tight">
              {ACTION_LABEL[result.recommended_action]}
            </div>
          </div>
        </div>
      </div>

      <hr className="my-12 border-0 border-t border-[color:var(--rule)]" />

      {/* BANT 2x2 grid */}
      <div className="rise rise-delay-2 grid grid-cols-1 sm:grid-cols-2">
        {BANT_ORDER.map((key, i) => {
          const cell = result.bant[key];
          const isRight = i % 2 === 1;
          const isBottom = i >= 2;
          return (
            <div
              key={key}
              className={[
                "py-8 sm:py-10",
                isRight ? "sm:pl-10" : "sm:pr-10",
                !isBottom ? "border-b border-[color:var(--rule)]" : "",
                isRight ? "sm:border-l border-[color:var(--rule)]" : "",
              ].join(" ")}
            >
              <div className="eyebrow">{BANT_LABEL[key]}</div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-5xl leading-none">
                  {cell.score}
                </span>
                <span className="font-display text-2xl leading-none text-[color:var(--muted)]">
                  / 5
                </span>
              </div>
              <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-[color:var(--muted)]">
                {cell.reasoning}
              </p>
            </div>
          );
        })}
      </div>

      <hr className="my-12 border-0 border-t border-[color:var(--rule)]" />

      {/* Summary */}
      <div className="rise rise-delay-3 grid grid-cols-12 gap-x-8">
        <div className="col-span-12 sm:col-span-3">
          <div className="eyebrow">— Summary</div>
        </div>
        <div className="col-span-12 mt-4 sm:col-span-9 sm:mt-0">
          <p className="font-display text-[1.375rem] leading-snug text-[color:var(--ink)]">
            {result.summary}
          </p>
        </div>
      </div>
    </section>
  );
}

function ScoreNumber({ score, tierColor }: { score: number; tierColor: string }) {
  // Score 0..100 → arc fill on a thin ring around the number.
  const r = 64;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - score / 100);
  const style = {
    ["--circumference" as string]: `${circumference}`,
    ["--target-offset" as string]: `${targetOffset}`,
  };

  return (
    <div className="flex items-center gap-6">
      <svg
        className="score-ring shrink-0"
        viewBox="0 0 160 160"
        width="160"
        height="160"
        style={style}
        aria-hidden
      >
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--rule)"
          strokeWidth="1.5"
        />
        <circle
          className="score-ring__fill"
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={tierColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div>
        <div className="eyebrow mb-2">Overall</div>
        <div className="font-display text-[clamp(4rem,9vw,7rem)] leading-none">
          {score}
          <span className="text-[color:var(--muted)]">
            <span className="font-display text-3xl align-top">/100</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ErrorBlock({ message, runId }: { message: string; runId?: string }) {
  return (
    <section aria-live="polite" className="rise">
      <div className="eyebrow mb-4 text-[color:var(--ember)]">Error</div>
      <h2 className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-tight">
        Something interrupted the analysis.
      </h2>
      <p className="mt-4 max-w-prose border-l-2 border-[color:var(--ember)] pl-4 text-sm leading-relaxed text-[color:var(--muted)]">
        {message}
        {runId ? (
          <span className="mt-2 block text-xs">run {runId}</span>
        ) : null}
      </p>
    </section>
  );
}
