---
name: Rust wasm32 SIGSEGV in this sandbox — hybrid sysroot fix
description: rustup-distributed rustc binaries crash with SIGSEGV during LLVM codegen in this Replit sandbox; nix-provided rustc works but lacks wasm32 target. Use a hybrid sysroot to get both.
---

Rustup-installed toolchains (any recent stable, tested 1.82.0/1.88.0/1.96.1) reliably SIGSEGV inside libLLVM during codegen (inliner/SelectionDAG passes) on anything beyond a trivial crate — even `unicode-ident` alone — regardless of opt-level, debug/release, LTO settings, or job parallelism. This is an environment-specific incompatibility with the rustup-distributed binary in this sandbox, not an OOM (cgroup memory.max/oom_kill checked and clean) and not a real code bug.

The Nix-provided `rust-mixed` toolchain (`rustc`/`cargo` already on PATH by default) compiles the exact same crates without crashing — but it only ships the `x86_64-unknown-linux-gnu` target (no `wasm32-unknown-unknown` std lib), and the Nix store is read-only so you can't add targets to it directly via rustup.

**Fix — hybrid sysroot:** since the Nix rustc and a rustup-installed toolchain of the *same version* (e.g. both 1.88.0) produce ABI-compatible rlibs, build a custom writable sysroot directory that symlinks Nix's `lib/rustlib/x86_64-unknown-linux-gnu`, `etc`, `src` alongside the rustup toolchain's `lib/rustlib/wasm32-unknown-unknown`, then compile with Nix's `cargo`/`rustc` (already on PATH) using `RUSTFLAGS="--sysroot=$CUSTOM_SYSROOT"`. This uses the working Nix rustc binary for actual codegen while pulling in the wasm32 target libs from rustup.

**Why:** Nix's rustc binary avoids whatever triggers the SIGSEGV (likely a JIT/mmap syscall incompatibility with the sandbox), while rustup is the only source of additional targets since the Nix store can't be modified in place.

**How to apply:** whenever compiling Rust to a non-default target (wasm32, etc.) in this environment and hitting rustc SIGSEGV crashes, install the matching rustup toolchain version + target only for its target libs (`rustup toolchain install <ver> --profile minimal && rustup target add wasm32-unknown-unknown --toolchain <ver>`), then build the hybrid sysroot dir with symlinks and pass `RUSTFLAGS="--sysroot=..."` to Nix's own `cargo build --target wasm32-unknown-unknown`.
