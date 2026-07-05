# StellarBin — Decentralized Liquidity Protocol

A full-stack DeFi boilerplate for a Dynamic Liquidity Market Maker (DLMM) on the Stellar network, inspired by Meteora on Solana.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/stellar-dlmm run dev` — run the DeFi frontend (port auto-assigned)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (optional for this app; data is computed)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite, TailwindCSS, shadcn/ui, Recharts, wouter
- Stellar SDK: @stellar/stellar-sdk (XDR/contract utilities in `src/lib/stellar.ts`)
- DB: PostgreSQL + Drizzle ORM (available, not yet used — pool data is computed)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod validators
- `artifacts/stellar-dlmm/src/` — DeFi frontend app
  - `src/lib/stellar.ts` — XDR encode/decode helpers, swap/liquidity builders
  - `src/pages/` — Swap, Pools, Pool Detail, Positions, Analytics
- `artifacts/api-server/src/routes/` — REST API handlers (pools, tokens, swap, transactions)
- `contracts/` — Soroban/Rust smart contracts
  - `contracts/math/` — Fixed-point math library (bin price, dynamic fee)
  - `contracts/dlmm/` — Main DLMM contract (add_liquidity_bin, remove_liquidity_bin, swap_exact_in_bin)
  - `contracts/vault/` — Dynamic vault with yield integration stub

## Architecture decisions

- **Discrete-bin AMM**: Instead of a continuous XYK curve, each bin is a constant-price sub-AMM. Swaps traverse bins sequentially, which enables capital concentration and precise range orders.
- **Dynamic fees**: Fees increase during high-volatility periods (short time since last trade) using a decay function — protects LPs from toxic flow at no cost to normal traders.
- **Fixed-point i128 math**: All Soroban arithmetic uses SCALAR=10^18 fixed-point integers to avoid floating-point and stay within the Soroban CPU/memory budget. Fast exponentiation (O(log n)) is used for bin price calculations.
- **API-first contract integration**: The frontend routes all blockchain calls through `src/lib/stellar.ts` helpers that produce unsigned transactions — wallet signing (Freighter/Albedo) is handled separately by the UI, keeping the encoding layer testable in isolation.
- **Computed pool data**: The backend serves realistic computed pool/bin/stats data so the UI is fully functional without on-chain deployment. Swap routes a quote through the same pricing logic as the contracts.

## Product

- **Swap** (`/swap`): Token pair selector, real-time quote via debounced mutation, price impact indicator, slippage settings, routing display, recent tx feed
- **Pools** (`/pools`): REAL aggregator, split into two categories — **DLMM** (our on-chain contract pool, TVL/price read live via RPC sim) and **AMM from Stellar DEX** (native-XLM constant-product pools aggregated live from Horizon `/liquidity_pools`). Category filter (All/DLMM/AMM) + search. HONESTY: only TVL and price are real; 24h volume/fees/APR are not indexed on testnet and render as `—` (`volumeAvailable=false`), never fabricated. DLMM rows → `Manage` (`/pools/:id`); AMM rows → `View` (external link to stellar.expert).
- **Pool Detail** (`/pools/:poolId`): DLMM bin distribution chart (Recharts), TVL/volume/fees history chart, Add/Remove liquidity modals with strategy presets (Spot, Curve, Bid-Ask)
- **Positions** (`/positions`): REAL per-bin LP positions read live from the DLMM contract for the connected wallet's address (no mock/demo fallback — requires wallet connect). Each card shows bin id, LP shares, token reserves, USD value. `Remove Liquidity` reuses `LiquidityModal` (mode=remove) to sign+submit a real `remove_liquidity_bin` tx. No fabricated fees/APR/strategy — `unrealizedFees` is not indexed on-chain so claim-fees UI was removed.
- **Analytics** (`/analytics`): Protocol-wide TVL/volume charts, top pools, recent transaction feed

## Smart Contracts (Soroban / Rust) — LIVE on Stellar Testnet

Located in `contracts/`. Compile with:
```bash
cd contracts && RUSTFLAGS="--sysroot=/home/runner/workspace/.local/share/custom-sysroot -C target-cpu=mvp" cargo build --target wasm32-unknown-unknown --release
```
Optimize (required before deploy — raw builds are rejected by the network):
```bash
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/<name>.wasm
```
Deploy with the Stellar CLI:
```bash
stellar contract deploy --wasm <optimized>.wasm --network testnet --source <deployer>
```

**Deployed testnet contract IDs** (network configurable via `.env`, currently testnet):
- DLMM: `CAWVYZS7FXVSOXTE7DBUULYOHCWVA2RML4CHXOETGS32FOBCOZ7YH4RS` (v2 — per-user LP position tracking)
- Vault: `CCDVBRMT3BI65JV2C7AQJOSIGT76MNNTXSVYDKGXKPBSOKVWQRGKU7VI`
- Math: `CB7U2EL6L4AR2IWANOSXDYVHWL3D3PD3XOZU6PUA4MDAVWCOT3AAVX4Z`
- Native XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- TESTUSD SAC: `CCA733ILFGI7SESYWNBYTKHUJTJTSU2ORRT6SFNSDZWHYSE4WDLLDUND`

All contract functions (initialize, add_liquidity_bin, simulate_swap, swap_exact_in_bin, remove_liquidity_bin, get_bin_reserves, vault deposit/withdraw/balance_of) have been smoke-tested on-chain with real transactions and transfer events.

**Frontend integration**: `artifacts/stellar-dlmm/src/lib/contracts.ts` reads contract IDs/network from env (`VITE_STELLAR_NETWORK`, `VITE_DLMM_CONTRACT_ID`, etc). `src/lib/dlmm-client.ts` builds real unsigned transactions (swap quote via `simulate_swap`, add/remove liquidity) using `rpc.Server.prepareTransaction`; the UI signs via Freighter/Albedo (`wallet.tsx`) and submits+polls for confirmation. The Swap page (`/swap`) is fully wired to on-chain quotes and execution. On the Pool Detail page, Add/Remove Liquidity only activates for the single pool whose `contractAddress` matches the live DLMM contract (`pool-xlm-testusd-live`) — all other pools remain illustrative/computed data, since only one bin (id 0) is initialized on-chain. Positions, Analytics, and the Pools list stay on computed backend data (full protocol-wide indexing is out of scope for this demo).

## Gotchas

- After any OpenAPI spec change, run codegen before modifying routes or frontend hooks.
- The `@stellar/stellar-sdk` package must be added to `artifacts/stellar-dlmm/package.json` before using `src/lib/stellar.ts` in components (`pnpm --filter @workspace/stellar-dlmm add @stellar/stellar-sdk`).
- Soroban contracts require Rust nightly + `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`.
- Raw `cargo build` wasm output is rejected by the Stellar network (LEB128/reference-types issue) — always run `stellar contract optimize` on the wasm before `deploy`.
- The workspace Orval config forces `info.title: Api` — do not rename it or generated filenames will break.
- Query params that match `<OperationIdPascal>Params` pattern cause TS2308 collisions in codegen — define them without query params or use path params instead.
- `contractAddress` is only present on the `PoolDetail` OpenAPI schema, not the list `Pool` schema — fetch a single pool to check whether it's the live on-chain pool.
- Real wallet signing (Freighter/Albedo) can't be exercised by automated screenshot/e2e tooling since it requires a real browser extension; verify contract correctness via direct CLI/RPC calls instead.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
