import { z } from "zod";

export const LeadInputSchema = z
  .object({
    email: z.string().email(),
    company: z.string().min(1),
    fullName: z.string().optional(),
    website: z.string().url().optional(),
    role: z.string().optional(),
    companySize: z
      .enum(["1-10", "11-50", "51-200", "201-1000", "1000+"])
      .optional(),
    industry: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    model: z.string().optional(),
  })
  .strict();

export type LeadInput = z.infer<typeof LeadInputSchema>;

const ScoreSchema = z.object({
  score: z.number().int().min(0).max(5),
  reasoning: z.string().min(1),
});

export const QualificationResultSchema = z
  .object({
    bant: z.object({
      budget: ScoreSchema,
      authority: ScoreSchema,
      need: ScoreSchema,
      timing: ScoreSchema,
    }),
    overall_score: z.number().int().min(0).max(100),
    qualified_tier: z.enum(["hot", "warm", "cold"]),
    recommended_action: z.enum([
      "call_now",
      "schedule_demo",
      "nurture_email",
      "request_more_info",
      "disqualify",
    ]),
    summary: z.string().min(1),
  })
  .strict();

export type QualificationResult = z.infer<typeof QualificationResultSchema>;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseLeadInput(raw: unknown): ParseResult<LeadInput> {
  const r = LeadInputSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    error: r.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; "),
  };
}

export function parseQualificationResult(
  raw: unknown,
): ParseResult<QualificationResult> {
  const r = QualificationResultSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    error: r.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; "),
  };
}
