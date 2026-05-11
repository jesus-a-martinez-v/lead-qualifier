import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import { DEFAULT_MODEL, openrouter } from "../lib/openrouter.js";
import { supabaseAdmin } from "../lib/supabase/admin.js";
import {
  type LeadInput,
  type QualificationResult,
  QualifyTaskPayloadSchema,
  parseQualificationResult,
} from "../types/lead.js";

type RunResult =
  | { status: "ok"; runId: string; result: QualificationResult }
  | {
      status: "error";
      runId: string;
      stage: "validate" | "llm" | "parse";
      error: string;
    };

const SYSTEM_PROMPT = `You are a B2B sales lead qualification analyst. You score every lead against the BANT framework (Budget, Authority, Need, Timing) using only the evidence provided in the lead payload — never invent facts.

For each BANT dimension, assign a score from 0 to 5:
  0 = no signal / cannot assess
  1 = strong negative signal
  2 = weak negative signal
  3 = neutral / unclear
  4 = positive signal
  5 = strong positive signal

Then compute overall_score = (budget + authority + need + timing) / 20 * 100, rounded to the nearest integer.

Tier from overall_score:
  >= 75 -> "hot"
  40-74 -> "warm"
  < 40  -> "cold"

Pick recommended_action using these rules (apply the first that matches):
  - "call_now"          if tier="hot" AND timing.score >= 4
  - "schedule_demo"     if tier="hot" OR (tier="warm" AND need.score >= 4)
  - "request_more_info" if tier="warm" AND at least two BANT dimensions have score <= 1
  - "nurture_email"     if tier="warm" or low-warm with positive long-term signals
  - "disqualify"        if tier="cold" AND authority.score <= 1 AND budget.score <= 1

Each "reasoning" field must be 1-2 short sentences citing specific evidence from the lead (role, company size, notes, etc.). The "summary" field is 2-3 sentences for the sales team.

Respond ONLY with a JSON object in EXACTLY this shape (no markdown, no commentary, no extra keys):

{
  "bant": {
    "budget":    { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "authority": { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "need":      { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "timing":    { "score": <0-5>, "reasoning": "<1-2 sentences>" }
  },
  "overall_score": <0-100 integer>,
  "qualified_tier": "hot" | "warm" | "cold",
  "recommended_action": "call_now" | "schedule_demo" | "nurture_email" | "request_more_info" | "disqualify",
  "summary": "<2-3 sentences>"
}`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bant: {
      type: "object",
      additionalProperties: false,
      properties: {
        budget: scoreSchema(),
        authority: scoreSchema(),
        need: scoreSchema(),
        timing: scoreSchema(),
      },
      required: ["budget", "authority", "need", "timing"],
    },
    overall_score: { type: "integer", minimum: 0, maximum: 100 },
    qualified_tier: { type: "string", enum: ["hot", "warm", "cold"] },
    recommended_action: {
      type: "string",
      enum: [
        "call_now",
        "schedule_demo",
        "nurture_email",
        "request_more_info",
        "disqualify",
      ],
    },
    summary: { type: "string", minLength: 1 },
  },
  required: [
    "bant",
    "overall_score",
    "qualified_tier",
    "recommended_action",
    "summary",
  ],
} as const;

function scoreSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "integer", minimum: 0, maximum: 5 },
      reasoning: { type: "string", minLength: 1 },
    },
    required: ["score", "reasoning"],
  } as const;
}

function buildUserMessage(lead: LeadInput): string {
  const lines: string[] = ["Lead to qualify:"];
  const push = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      lines.push(`- ${label}: ${value}`);
    }
  };
  push("Email", lead.email);
  push("Full name", lead.fullName);
  push("Company", lead.company);
  push("Website", lead.website);
  push("Role / title", lead.role);
  push("Company size", lead.companySize);
  push("Industry", lead.industry);
  push("Source", lead.source);
  push("SDR notes", lead.notes);
  return lines.join("\n");
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

async function finalize(
  qualificationId: string | undefined,
  patch:
    | { status: "completed"; result: QualificationResult }
    | { status: "failed"; error: string },
): Promise<void> {
  if (!qualificationId) return;
  try {
    const { error } = await supabaseAdmin()
      .from("qualifications")
      .update(patch)
      .eq("id", qualificationId);
    if (error) logger.error("supabase update failed", { qualificationId, error: error.message });
  } catch (e) {
    logger.error("supabase update threw", { qualificationId, error: errMessage(e) });
  }
}

export const qualifyLeadTask = task({
  id: "qualify-lead",
  retry: { maxAttempts: 3 },
  maxDuration: 120,
  run: async (raw: unknown, { ctx }): Promise<RunResult> => {
    const runId = ctx.run.id;
    metadata.set("status", "validating");

    const parsed = QualifyTaskPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const error = parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      logger.error("validate failed", { runId, error });
      // No qualificationId available — caller (server action) marks the row failed.
      return { status: "error", runId, stage: "validate", error };
    }
    const { qualificationId, userId, ...lead } = parsed.data;
    logger.log("lead parsed", {
      runId,
      qualificationId,
      userId,
      email: lead.email,
      company: lead.company,
    });

    const model = lead.model ?? DEFAULT_MODEL;
    metadata.set("status", "calling_llm");
    metadata.set("model", model);

    let rawJson: string;
    try {
      const client = openrouter();
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(lead) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "QualificationResult",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      });
      rawJson = completion.choices[0]?.message?.content ?? "";
      logger.log("llm response received", {
        runId,
        usage: completion.usage,
        bytes: rawJson.length,
      });
    } catch (e) {
      const error = errMessage(e);
      logger.error("llm call failed", { runId, error });
      await finalize(qualificationId, { status: "failed", error });
      return { status: "error", runId, stage: "llm", error };
    }

    metadata.set("status", "parsing_result");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFence(rawJson));
    } catch (e) {
      const error = `LLM returned non-JSON: ${errMessage(e)}`;
      logger.error("parse failed", { runId, error, rawJson: rawJson.slice(0, 500) });
      await finalize(qualificationId, { status: "failed", error });
      return { status: "error", runId, stage: "parse", error };
    }

    const validated = parseQualificationResult(parsedJson);
    if (!validated.ok) {
      logger.error("schema mismatch", { runId, error: validated.error });
      await finalize(qualificationId, { status: "failed", error: validated.error });
      return { status: "error", runId, stage: "parse", error: validated.error };
    }

    metadata.set("status", "complete");
    logger.log("qualification complete", {
      runId,
      tier: validated.value.qualified_tier,
      action: validated.value.recommended_action,
      score: validated.value.overall_score,
    });

    await finalize(qualificationId, { status: "completed", result: validated.value });

    return { status: "ok", runId, result: validated.value };
  },
});
