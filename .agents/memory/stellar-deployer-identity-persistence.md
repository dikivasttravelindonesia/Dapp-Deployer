---
name: Stellar CLI identity persistence and version pinning
description: Where the Soroban deployer/holder keypairs actually persist across container resets, and how to pick a compatible stellar-cli version
---

The `stellar` CLI's identity store (`stellar keys generate`) writes to `.config/stellar/identity/*.toml` resolved relative to the CLI's XDG config dir, which in this project lands inside the workspace directory tree (not `$HOME/.config`). That means deployer/holder keypairs survive container/environment resets even though `$HOME` and installed binaries (like the `stellar` CLI itself) do not.

**Why:** Lost time previously assuming the deployer secret key was gone forever after the CLI binary disappeared from a reset container, when only the binary was gone — the actual identity files were untouched in the workspace.

**How to apply:** Before generating a new identity or redeploying a "replacement" token because a signing key seems lost, run `stellar keys ls` / `stellar keys address <name>` after reinstalling the CLI — the old identities are very likely still there if they were ever created within this workspace's checkout.

Separately: `stellar-cli` version must match the target network's Soroban protocol version or you get an opaque `xdr processing error: xdr value invalid` on deploy. Check the live protocol version via `POST {rpc_url}` with `{"method":"getNetwork"}` (returns `protocolVersion`), then grab the matching (or newest) `stellar-cli` release from `https://github.com/stellar/stellar-cli/releases` — prebuilt Linux binaries (`stellar-cli-<ver>-x86_64-unknown-linux-gnu.tar.gz`) install in seconds vs. several minutes for `cargo install`.
