# 02 — Qualification rubric (BANT)

> **Status: defined.** Change this file if you want to adjust scoring; the prompt and types in `src/types/lead.ts` must stay in sync.

## Goal
Score every incoming lead against **BANT** (Budget, Authority, Need, Timing) and produce a structured recommendation the frontend can render.

## Input — `LeadInput`

| Field | Required | Notes |
|-------|----------|-------|
| `email` | ✅ | Used as the lead identifier |
| `company` | ✅ | Company name |
| `fullName` | ⬜ | |
| `website` | ⬜ | Useful signal — LLM can infer industry / size from it |
| `role` | ⬜ | Job title; primary signal for **Authority** |
| `companySize` | ⬜ | Headcount band (e.g. "1-10", "11-50", "51-200", "201-1000", "1000+"); primary signal for **Budget** |
| `industry` | ⬜ | Free text |
| `source` | ⬜ | Where the lead came from (referral, ad, website form, event, …) |
| `notes` | ⬜ | Free-text SDR notes; usually the richest signal for **Need** and **Timing** |

## Output — `QualificationResult`

```ts
type Score = {
  score: 0 | 1 | 2 | 3 | 4 | 5;   // 0 = no signal, 5 = strong positive signal
  reasoning: string;               // 1-2 sentences citing specific evidence from the lead
};

type QualificationResult = {
  bant: {
    budget: Score;
    authority: Score;
    need: Score;
    timing: Score;
  };
  overall_score: number;           // 0-100, weighted from BANT (see scoring below)
  qualified_tier: "hot" | "warm" | "cold";
  recommended_action:
    | "call_now"
    | "schedule_demo"
    | "nurture_email"
    | "request_more_info"
    | "disqualify";
  summary: string;                 // 2-3 sentence executive summary
};
```

## Scoring

`overall_score = (budget + authority + need + timing) / 20 * 100` — equal weights.

| Tier | Range |
|------|-------|
| hot  | ≥ 75 |
| warm | 40-74 |
| cold | < 40 |

The LLM picks `recommended_action` using these heuristics — written into the system prompt:
- **call_now** — hot tier with strong Timing (≥ 4)
- **schedule_demo** — hot or high-warm with strong Need
- **request_more_info** — warm but low-signal across multiple BANT dimensions
- **nurture_email** — low-warm or borderline cold with positive long-term signals
- **disqualify** — cold AND no Authority/Budget signal

## Verification
- After deploying, run the task with the three sample leads in `tools/sample-leads.ts` (hot / warm / cold) and confirm tiers and actions look right.
