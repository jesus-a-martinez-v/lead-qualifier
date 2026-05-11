# Tools

This is the **T** in WAT — helper scripts Claude Code (the **A**gent) can run during development.

These scripts are **not** part of the deployed product. They exist to make iterating on the lead qualifier faster: seeding sample leads, hitting the local dev server with a known payload, deploying with the right flags, etc.

## Conventions

- Shell scripts: `*.sh`, executable (`chmod +x`), with a one-line comment at the top describing what they do.
- TypeScript scripts: `*.ts`, runnable via `npx tsx tools/<name>.ts`.
- One purpose per script. If a script grows past ~50 lines or starts taking flags, consider splitting it.
- Scripts may read `.env.local` / `.env` but must not contain secrets.

## Currently available

*(none yet — add them as the project grows)*

## Suggested first additions

- `tools/test-lead.sh` — POST a sample lead JSON to the local Next.js dev server and print the resulting run id.
- `tools/seed-samples.ts` — a small fixture file of representative leads (great + mediocre + bad) for repeated end-to-end testing.
- `tools/run-task.ts` — invoke `qualifyLead` directly via the Trigger.dev SDK, bypassing the frontend, useful when iterating on the prompt.

When you add a script, list it under **Currently available** above with a one-line description.
