"use server";

// Alias the Trigger.dev `auth` to avoid collision with the Auth.js `auth()` helper.
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { LeadInputSchema, type LeadInput } from "@/types/lead";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { qualifications } from "@/lib/db/schema";
import { getBillingState, getCompletedTodayUTC } from "@/lib/billing/state";
import { FREE_DAILY_LIMIT } from "@/lib/billing/plans";

export type QualifyHandle = {
  runId: string;
  publicAccessToken: string;
};

export type QualifyResponse =
  | { ok: true; handle: QualifyHandle }
  | { ok: false; error: string; code?: "LIMIT_REACHED" };

export async function qualifyAction(input: LeadInput): Promise<QualifyResponse> {
  const parsed = LeadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; "),
    };
  }

  if (!process.env.TRIGGER_SECRET_KEY) {
    return {
      ok: false,
      error:
        "TRIGGER_SECRET_KEY is not set. Add it to .env.local (dev key from cloud.trigger.dev).",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to qualify a lead." };
  }
  const userId = session.user.id;

  const { isPro } = await getBillingState(userId);
  if (!isPro) {
    const used = await getCompletedTodayUTC(userId);
    if (used >= FREE_DAILY_LIMIT) {
      return {
        ok: false,
        code: "LIMIT_REACHED",
        error: `Daily free limit reached (${used}/${FREE_DAILY_LIMIT}). Upgrade to Pro for unlimited qualifications.`,
      };
    }
  }

  const [row] = await db
    .insert(qualifications)
    .values({
      userId,
      status: "pending",
      leadInput: parsed.data,
    })
    .returning({ id: qualifications.id });

  if (!row) {
    return { ok: false, error: "Failed to record qualification." };
  }

  try {
    const handle = await tasks.trigger("qualify-lead", {
      ...parsed.data,
      qualificationId: row.id,
      userId,
    });

    await db
      .update(qualifications)
      .set({ runId: handle.id })
      .where(eq(qualifications.id, row.id));

    const publicAccessToken = await triggerAuth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
      expirationTime: "1h",
    });
    return { ok: true, handle: { runId: handle.id, publicAccessToken } };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db
      .update(qualifications)
      .set({ status: "failed", error })
      .where(eq(qualifications.id, row.id));
    return { ok: false, error };
  }
}
