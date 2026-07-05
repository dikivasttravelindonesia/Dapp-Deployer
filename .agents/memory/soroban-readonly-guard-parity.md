---
name: Soroban read-only vs state-changing function parity
description: Guards enforced in state-changing contract functions must be mirrored in their read-only simulate/quote counterparts
---

In a Soroban contract that exposes both a state-changing action (e.g. `swap_exact_in_bin`) and a read-only simulation/quote of that same action (e.g. `simulate_swap`), any `assert!`/guard added to the state-changing function (activation-time gates, pause flags, allow-lists, etc.) must be duplicated in the read-only counterpart too.

**Why:** The two functions are easy to write and review separately since one mutates state and one doesn't, but the frontend calls the read-only one first (to render a quote) and only calls the state-changing one on submit. If the guard is missing from the read-only path, the UI shows a valid-looking quote for an action that will then fail when actually submitted — a confusing "quote says X, execution rejects" bug rather than a clean upfront error.

**How to apply:** Whenever adding or changing an invariant in a state-changing contract function, grep for its read-only sibling (usually named `simulate_*`, `preview_*`, `quote_*`, or `get_*`) and add/update the same guard there. Add a regression test that exercises the guard from both entry points.
