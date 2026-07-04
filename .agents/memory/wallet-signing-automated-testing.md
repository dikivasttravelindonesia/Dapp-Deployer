---
name: Wallet signing can't be automated in e2e tools
description: Real browser-extension wallet flows (Freighter/Albedo) cannot be driven by the screenshot/e2e testing tools available in this environment.
---

Screenshot and Playwright-based e2e testing tools in this environment run a headless/managed browser without real crypto wallet extensions installed. Any UI flow gated behind "Connect Wallet" (Freighter, Albedo, MetaMask, etc.) cannot be exercised end-to-end this way — the connect button will render, but the actual extension popup and signing step can't be triggered or approved.

**Why:** Spent time trying to fully e2e-test a Stellar DLMM swap/liquidity flow through the UI; the wallet-gated steps (sign transaction, submit) are unreachable without a real extension.

**How to apply:** For wallet-gated on-chain features, verify: (1) the UI renders and gates correctly up to the connect/sign step via screenshots, (2) the underlying contract calls work correctly via direct RPC/CLI testing (e.g. Stellar CLI `contract invoke`, simulate calls) independent of the UI, and (3) the client code that builds/submits transactions typechecks and matches the wallet interface. Don't claim full e2e coverage of wallet-signed flows — call out the gap explicitly to the user.
