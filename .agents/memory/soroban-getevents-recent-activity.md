---
name: Reading recent contract activity via Soroban RPC getEvents
description: How to read past contract events (e.g. swap history) from a Soroban contract without an indexer, and its constraints.
---

For "recent activity" UI (e.g. a swap feed) backed by a live Soroban contract with no indexer, `rpc.Server.getEvents()` is the right tool — not `simulateTransaction` reads (those only reflect current state, not history).

**Why:** `stellar-reader.ts`-style read helpers in this project use `simulateTransaction` for current on-chain state (config, bins, positions). That pattern cannot answer "what happened recently" — only `getEvents` can, since it queries the ledger's event stream by contract id + topic filter.

**How to apply:**
- Build topic filters as base64 XDR: `xdr.ScVal.scvSymbol("EVENT_NAME").toXDR("base64")`, with `"*"` wildcards for topic positions you don't want to constrain.
- Public testnet RPC providers only retain `getEvents` history for roughly a day (~9000 ledgers at ~5s/ledger) — always compute `startLedger` relative to `getLatestLedger()` rather than a fixed ledger number, and keep the lookback window conservative to avoid retention-window errors.
- This data source is inherently non-realtime/poll-based (no push/subscribe API), so cache with a short TTL (e.g. 30s) rather than treating it as live.
- Decode `evt.topic` (array of ScVal) and `evt.value` (single ScVal) with `scValToNative`; `evt.txHash` and `evt.ledgerClosedAt` give you the tx reference and timestamp for display.
