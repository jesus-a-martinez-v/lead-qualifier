import { defineConfig } from "@trigger.dev/sdk/v3";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

const SYNCED_VARS = [
  "OPENROUTER_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export default defineConfig({
  project: "proj_yaxtvgmpfxzadpthznyb",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      syncEnvVars(async () => {
        const out: Record<string, string> = {};
        for (const k of SYNCED_VARS) {
          const v = process.env[k];
          if (v) out[k] = v;
        }
        return out;
      }),
    ],
  },
});
