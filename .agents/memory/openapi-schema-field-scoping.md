---
name: OpenAPI list vs. detail schema field scoping
description: A field visible in a detail response can be silently missing from the corresponding list response due to schema differences, not a route bug.
---

If a response is missing a field you know the handler sets, check the OpenAPI schema for that endpoint before debugging the route logic. Contract-first codegen (Orval + Zod) validates/strips responses against the schema tied to each operation. It's common to define a lean "list" schema (e.g. `Pool`) and a richer "detail" schema (e.g. `PoolDetail`) that includes extra fields like an on-chain `contractAddress`. A field present on the detail schema will not appear on list endpoints even if the underlying data object has it set — the list schema silently strips it.

**Why:** Wasted time was spent assuming a missing field meant the data wasn't populated, when actually the field was present in the data but stripped by response validation against the wrong (list) schema.

**How to apply:** When a field seems to "vanish" from an API response in this repo's contract-first setup, grep `lib/api-spec/openapi.yaml` for the schema name used by that specific operation before looking at the route handler.
