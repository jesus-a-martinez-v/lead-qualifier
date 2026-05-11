"use server";

import { auth, tasks } from "@trigger.dev/sdk/v3";
import { LeadInputSchema, type LeadInput } from "@/types/lead";
import { supabaseServer } from "@/lib/supabase/server";

export type QualifyHandle = {
  runId: string;
  publicAccessToken: string;
};

export type QualifyResponse =
  | { ok: true; handle: QualifyHandle }
  | { ok: false; error: string };

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

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to qualify a lead." };
  }

  const { data: row, error: insertError } = await supabase
    .from("qualifications")
    .insert({
      user_id: user.id,
      status: "pending",
      lead_input: parsed.data,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to record qualification.",
    };
  }

  try {
    const handle = await tasks.trigger("qualify-lead", {
      ...parsed.data,
      qualificationId: row.id,
      userId: user.id,
    });

    await supabase
      .from("qualifications")
      .update({ run_id: handle.id })
      .eq("id", row.id);

    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
      expirationTime: "1h",
    });
    return { ok: true, handle: { runId: handle.id, publicAccessToken } };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await supabase
      .from("qualifications")
      .update({ status: "failed", error })
      .eq("id", row.id);
    return { ok: false, error };
  }
}
