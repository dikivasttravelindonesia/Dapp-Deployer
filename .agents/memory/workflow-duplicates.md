---
name: Duplicate artifact workflows on same port
description: Why an artifact service can fail to pick up new code (EADDRINUSE) when two workflows run the same server.
---

An artifact service (e.g. the api-server) can end up with **two** workflows that both run the same dev command and bind the same port:
- a manually-created one (e.g. named "API Server" with explicit `PORT=8080 ...`)
- the artifact-managed one auto-created by artifact registration (named `artifacts/<slug>: <title>`), which gets its port from `.replit-artifact/artifact.toml`

**Symptom:** restarting one workflow fails with `EADDRINUSE 0.0.0.0:<port>` because the other still holds the port; the running one serves **stale bundled code**, so API responses don't reflect your edits even after a restart.

**Fix / rule:** keep only the artifact-managed workflow (`artifacts/<slug>: ...`) — it's canonical and tied to `artifact.toml`. Remove the redundant manual one with `removeWorkflow({ name })`, then restart the artifact-managed one so it rebuilds.

**How to apply:** if edits to a server aren't reflected after a restart, run `listWorkflows()` and check for two workflows targeting the same artifact/port before debugging the code.
