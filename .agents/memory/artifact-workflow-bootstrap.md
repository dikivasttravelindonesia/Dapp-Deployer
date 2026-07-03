---
name: Starting an artifact workflow that has none configured
description: How to bring up a dev server for an artifact when "no workflows configured" and configureWorkflow fails with PORT/port-in-use errors.
---

When an artifact exists (registered via artifact.toml) but no workflow is running it yet:

1. Read the artifact's `.replit-artifact/artifact.toml` — the `[services.env]` block has the exact `PORT` and `BASE_PATH` the dev server expects, and `[services.development].run` has the command.
2. Call `configureWorkflow` with those env vars inlined directly in the command string (e.g. `PORT=20441 BASE_PATH=/ pnpm --filter @workspace/<slug> run dev`) — a bare `pnpm --filter ... run dev` will fail because Vite configs in this template require `PORT` from the environment.
3. If it fails with "Port already in use", a previous attempt likely left an orphaned vite process bound to that port (ps aux | grep vite, then kill -9 the PID) — `fuser`/`lsof` are not available in this environment, use `ps aux` + `kill` instead.

**Why:** Free/degraded-tier environments can end up with an artifact.toml but zero configured workflows; the artifact's own toml is the source of truth for the correct port/env, not the generic dev script.
