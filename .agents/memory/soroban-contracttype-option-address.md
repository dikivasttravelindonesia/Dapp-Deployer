---
name: soroban-sdk 20.x contracttype Option<Address> limitation
description: #[contracttype] structs with Option<Address> (or similar) fields fail to compile with a confusing trait-bound error
---

## Symptom

```
error[E0277]: the trait bound `soroban_sdk::xdr::ScVal: TryFrom<&core::option::Option<soroban_sdk::Address>>` is not satisfied
  --> vault/src/lib.rs:34:1
   |
34 | #[contracttype]
```

The error points at the `#[contracttype]` derive macro line, not the actual
field, which makes it non-obvious which field is the problem.

## Root cause

soroban-sdk 20.x's `#[contracttype]` derive does not support `Option<Address>`
fields (and likely other `Option<T>` combos where `T`'s `IntoVal`/`TryFromVal`
impls don't compose the way the macro expects). This is a real compile-time
limitation of that SDK version, not a project bug.

## Fix

Don't store the optional field inside the `#[contracttype]` struct. Instead:

1. Remove the `Option<Address>` field from the struct.
2. Store it as a separate persistent storage entry under its own `Symbol` key.
3. Use `env.storage().persistent().has(&KEY)` to check presence, and
   `.get(&KEY)` only when set — this replaces the `Option::is_some()` /
   `Option::None` pattern entirely.

**Why:** avoids the macro limitation while keeping the same optional
semantics; presence-of-key is a normal Soroban idiom for "optional" contract
state.

**How to apply:** whenever a `#[contracttype]` struct needs an optional
`Address` (or other complex optional field), split it into its own storage
key rather than wrapping it in `Option<T>` inside the struct.
