---
name: Soroban wasm deploy rejects modern rustc output
description: Deploy fails with "reference-types not enabled: zero byte expected" even though the contract code is correct
---

## Symptom

`stellar contract deploy` fails simulation with:

```
HostError: Error(WasmVm, InvalidAction)
... TranslationError ... "reference-types not enabled: zero byte expected"
```

This looks like a target-feature problem (reference-types/bulk-memory/multivalue)
but setting `-C target-feature=-reference-types,...` or even `-C target-cpu=mvp`
in RUSTFLAGS does **not** fix it — the error persists with byte-identical output.

## Root cause

Recent rustc/LLVM (observed with rustc 1.88.0) emits the `call_indirect`
instruction's reserved table-index byte as an overlong 5-byte LEB128 encoding
of zero, instead of the single canonical `0x00` byte the WASM MVP spec/strict
parsers expect. This is a linker/codegen encoding quirk, not an actual use of
the reference-types feature — so target-feature flags have no effect on it.
Soroban's wasm parser (unlike lenient tools like wabt/wasm2wat) enforces the
strict single-byte encoding and rejects the module.

## Fix

Run the contract wasm through Soroban's own optimizer before deploying —
it re-encodes with Binaryen (`wasm-opt`) and normalizes the LEB128 encodings:

```bash
stellar contract optimize --wasm path/to/contract.wasm
# or, on newer CLI versions:
stellar contract build --optimize
```

Then deploy the `.optimized.wasm` output, not the raw `cargo build` output.
This should be a standard step for every Soroban contract build in this
environment (and is good practice generally — it also shrinks binary size
substantially, e.g. 30KB -> 25KB observed).

**Why:** without this step, deployment fails even though `cargo build` and
`cargo test` both succeed — the contract logic is fine, only the raw linker
output is incompatible with Soroban's strict wasm validator.

**How to apply:** always pipe `cargo build --target wasm32-unknown-unknown
--release` output through `stellar contract optimize` (or `stellar contract
build --optimize` on CLI >=22) before running `stellar contract deploy`.
