"use server";

import { auth, tasks } from "@trigger.dev/sdk/v3";
import { LeadInputSchema, type LeadInput } from "@/types/lead";

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

  try {
    const handle = await tasks.trigger("qualify-lead", parsed.data);
    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
      expirationTime: "1h",
    });
    return { ok: true, handle: { runId: handle.id, publicAccessToken } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
