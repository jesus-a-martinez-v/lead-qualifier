# Workflows

This is the **W** in WAT — playbooks that tell Claude Code (the **A**gent) how to perform each kind of task in this repo.

## How to use a playbook

Before starting a task, look here for a file whose name matches what you're about to do. If one exists, follow it step-by-step. If you deviate, note why in your response so the next session can update the playbook.

## Current playbooks

| File | Purpose |
|------|---------|
| [01-bootstrap-project.md](01-bootstrap-project.md) | Scaffold Next.js + Trigger.dev v3, init git, push to GitHub, link to Vercel |
| [02-define-rubric.md](02-define-rubric.md) | Define the lead qualification rubric (input fields, scoring, output schema) |
| [03-build-qualifier-task.md](03-build-qualifier-task.md) | Implement the Trigger.dev task that calls OpenRouter and returns the qualification |
| [04-build-frontend-form.md](04-build-frontend-form.md) | Next.js form + server action + realtime results UI |
| [05-deploy.md](05-deploy.md) | Deploy Trigger.dev tasks and verify Vercel auto-deploy |

## How to write a new playbook

When you finish a non-trivial task that doesn't have a playbook, add one. Keep it short and copy-pasteable. Recommended structure:

```markdown
# <Task name>

## Goal
One sentence — what done looks like.

## Preconditions
What must already be true / installed / configured.

## Steps
1. ...
2. ...

## Verification
How to confirm it worked end-to-end (a command, a URL to hit, a thing to see in a UI).

## Gotchas
Things that bit us last time. Optional but valuable.
```

Number the file with the next available prefix (`06-...`) if it represents a stage in the build, or use a descriptive name without a prefix (e.g. `add-llm-tool.md`) if it's a recurring sub-task.
