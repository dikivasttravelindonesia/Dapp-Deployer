---
name: Protocol-wide historical charts without a dedicated endpoint
description: How Analytics page TVL/Volume charts are built when only per-pool history exists
---

The API only exposes per-pool historical stats (`getPoolStats(poolId)` → `PoolStats.data[]`), not a protocol-wide history endpoint (`getProtocolSummary` is current-totals only).

To build protocol-wide TVL/Volume charts, fetch all pools via `listPools`, call the plain (non-hook) `getPoolStats` client function for each pool id in parallel inside a custom `useQuery`, then sum `tvl`/`volume`/`fees` across pools by matching `timestamp` string.

**Why:** Generated React Query hooks can't be called a variable number of times (one per pool) inside a component — hooks must be static. Using the plain async client function inside a manually-authored `useQuery` sidesteps the rules-of-hooks issue while still getting caching/loading state.

**How to apply:** Any future "protocol-wide over time" chart in this app should follow the same aggregate-per-pool pattern unless a real protocol-history endpoint is added to the OpenAPI spec.
