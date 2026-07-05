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
- **Multi-pool registry, single contract**: One deployed DLMM contract hosts every pool (Standard + Launch) via a numeric `pool_id`; all storage keys (Config, Active, LastTs, Bin, AllBins, Share, TotalShare, UserBins) are namespaced by `pool_id`. `create_pool` is permissionless — any wallet can register a new pool without a redeploy.
- **Platform fee split**: Every swap fee is split between LPs and a protocol treasury via a contract-wide `protocol_fee_bps` (default 2000 = 20% protocol / 80% LP), adjustable only by the contract admin via `set_protocol_fee_bps`. Protocol fees accrue per-pool-per-token and are withdrawable via `withdraw_protocol_fees(pool_id, admin)`.
- **Launch Pool anti-snipe**: `create_pool` takes an `activation_ts`. `0` = Standard Pool (swaps allowed immediately). A future timestamp = Launch Pool — `swap_exact_in_bin`/`simulate_swap` reject with a clear error until `now >= activation_ts`, while `add_liquidity_bin` is always allowed so LPs can seed the pool ahead of launch.

## Product

- **Swap** (`/swap`): Token pair selector, real-time quote via debounced mutation, price impact indicator, slippage settings, routing display, recent tx feed
- **Pools** (`/pools`): REAL aggregator, split into two categories — **DLMM** (pools registered in our on-chain multi-pool contract, TVL/price read live via RPC sim) and **AMM from Stellar DEX** (native-XLM constant-product pools aggregated live from Horizon `/liquidity_pools`). Category filter (All/DLMM/AMM) + search. HONESTY: only TVL and price are real; 24h volume/fees/APR are not indexed on testnet and render as `—` (`volumeAvailable=false`), never fabricated. DLMM rows → `Manage` (`/pools/:id`), with a `Launch` badge for pools still gated pre-activation; AMM rows → `View` (external link to stellar.expert). A `Create` button links to `/create`.
- **Create** (`/create`): Real permissionless pool creation UI (Meteora-style). Choose **DLMM Standard Pool** (active immediately) or **DLMM Launch Pool** (swaps gated until a chosen activation time, anti-snipe), set token pair/bin step/base fee/initial active bin, review in a "Pool Preview" card showing the LP/protocol fee split, then sign+submit a real `create_pool` transaction. On success, redirects to the new pool's detail page.
- **Pool Detail** (`/pools/:poolId`): DLMM bin distribution chart (Recharts), TVL/volume/fees history chart, LP/protocol fee-split bar, live countdown banner for not-yet-active Launch Pools, Add/Remove liquidity modals with strategy presets (Spot, Curve, Bid-Ask). Real on-chain liquidity actions are wired to any pool with a `dlmmPoolId` (i.e. any pool created via the registry), not just one hardcoded pool.
- **Positions** (`/positions`): REAL per-bin LP positions read live from the DLMM contract for the connected wallet's address (no mock/demo fallback — requires wallet connect). Each card shows bin id, LP shares, token reserves, USD value. `Remove Liquidity` reuses `LiquidityModal` (mode=remove, threaded with the position's `dlmmPoolId`) to sign+submit a real `remove_liquidity_bin` tx. No fabricated fees/APR/strategy — `unrealizedFees` is not indexed on-chain so claim-fees UI was removed.
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
- DLMM: `CCW5MVYJFJPBJNJY7GN6BHC5BQR47RXVIM2T2X4F3YSQC7MQ7J4GNESH` (v5 — fixed a critical bin step-direction bug in `swap_exact_in_bin`/`simulate_swap`: the active-bin traversal moved in the wrong direction when a bin ran out of liquidity, walking the pool's active bin into permanently empty territory instead of toward the bins that actually hold the needed reserves, silently returning `amount_out=0` on all subsequent swaps. Bins above the active bin hold only token X, bins below hold only token Y — buying Y (x_to_y=true) must step toward lower bins, selling Y (x_to_y=false) toward higher bins; the old code had this inverted. Replaces the v4 `CCAP3SFH...` contract, whose pool 0/1 active-bin pointers were unrecoverably stranded by this bug)
- Vault: `CCDVBRMT3BI65JV2C7AQJOSIGT76MNNTXSVYDKGXKPBSOKVWQRGKU7VI`
- Math: `CB7U2EL6L4AR2IWANOSXDYVHWL3D3PD3XOZU6PUA4MDAVWCOT3AAVX4Z`
- Native XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- TESTUSD SAC: `CCA733ILFGI7SESYWNBYTKHUJTJTSU2ORRT6SFNSDZWHYSE4WDLLDUND`

The DLMM contract is `initialize(admin)`d once with the deployer as admin. Pool `0` is a seeded Standard Pool (XLM/TESTUSD, bin_step=25bps, base_fee=10bps) — see `contracts/scripts/seed_pool.sh` to seed additional pools/bins from the CLI (supports `ACTIVATION_TS` for Launch Pools). `VITE_DEFAULT_POOL_ID`/`DEFAULT_POOL_ID` (`.env`, currently `0`) is the fallback pool_id used where a caller doesn't pass one explicitly.

All contract functions (initialize, create_pool, add_liquidity_bin, simulate_swap, swap_exact_in_bin, remove_liquidity_bin, get_bin_reserves, list_pools, set_protocol_fee_bps, withdraw_protocol_fees, vault deposit/withdraw/balance_of) have been smoke-tested on-chain with real transactions and transfer events.

**Frontend integration**: `artifacts/stellar-dlmm/src/lib/contracts.ts` reads contract IDs/network/`DEFAULT_POOL_ID` from env (`VITE_STELLAR_NETWORK`, `VITE_DLMM_CONTRACT_ID`, etc). `src/lib/dlmm-client.ts` builds real unsigned transactions (swap quote via `simulate_swap`, add/remove liquidity, create_pool) using `rpc.Server.prepareTransaction`, threading a `poolId` param (defaulting to `DEFAULT_POOL_ID`) through every call so the same contract instance serves every pool; the UI signs via Freighter/Albedo (`wallet.tsx`) and submits+polls for confirmation. The Swap page (`/swap`) is fully wired to on-chain quotes and execution against the default pool. On the Pool Detail page, Add/Remove Liquidity activate for any pool with a `dlmmPoolId` (i.e. any pool registered in the contract via `create_pool`), not a single hardcoded pool. Positions and Analytics stay on computed backend data for stats not derivable purely on-chain (full protocol-wide indexing is out of scope for this demo).

## Deploying `api-server` to Vercel (alternative to Replit deployment)

Vercel's own Node.js function builder type-checks `.ts` files with its own `tsc` pass and does not understand this repo's pnpm-workspace TypeScript setup (`moduleResolution: "bundler"`, `workspace:*` packages resolved to raw `.ts` source) — pointing it directly at `src/app.ts` fails with spurious type errors (e.g. `pino-http` "not callable").

Instead:
- `build.mjs` also bundles `src/app.ts` (the bare Express app, no `app.listen()`) into plain JS at `dist/app.mjs` via esbuild, alongside the existing `dist/index.mjs` used by Replit's persistent server.
- `artifacts/api-server/api/index.mjs` is a plain-JS (not TS) Vercel serverless entry point that imports the pre-bundled `dist/app.mjs` and exports it as a `(req, res) => void` handler — since it's already plain JS by the time Vercel's function builder sees it, there's nothing left for Vercel to type-check.
- `artifacts/api-server/vercel.json` sets `installCommand`/`buildCommand` to `cd ../.. && pnpm ...` (so pnpm resolves the workspace from the repo root) and rewrites `/api/(.*)` → `/api` so all API subpaths hit the one function.

To deploy on Vercel: create a project pointed at this GitHub repo, set **Root Directory** to `artifacts/api-server`, set **Framework Preset** to "Other" (auto-detected "Express" fights with our custom setup), and enable the monorepo "include files outside the Root Directory" option if prompted (needed so pnpm can see `pnpm-workspace.yaml` and sibling `lib/*` packages).

### Serving the frontend (`stellar-dlmm`) from the same Vercel project/domain

`vercel.json`'s `buildCommand` also builds `@workspace/stellar-dlmm` (with `BASE_PATH=/` so it's rooted at the domain root instead of an artifact sub-path) and copies its `dist/public` output into `artifacts/api-server/public` — the `outputDirectory` Vercel serves as static files. A catch-all rewrite (`/(.*)` → `/index.html`, listed after the `/api` rewrite) gives the client-side router (wouter) SPA fallback behavior; Vercel serves real static files (JS/CSS/images) directly without invoking rewrites, so this doesn't break asset loading.

The frontend's `VITE_*` build-time env vars (Stellar network/contract IDs — public, not secret) live in `vercel.json`'s `build.env` block instead of `artifacts/stellar-dlmm/.env`, because that `.env` file is gitignored and never reaches a GitHub-sourced Vercel build. Keep both in sync when contract IDs change (e.g. after a redeploy).

## Gotchas

- After any OpenAPI spec change, run codegen before modifying routes or frontend hooks.
- The `@stellar/stellar-sdk` package must be added to `artifacts/stellar-dlmm/package.json` before using `src/lib/stellar.ts` in components (`pnpm --filter @workspace/stellar-dlmm add @stellar/stellar-sdk`).
- Soroban contracts require Rust nightly + `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`.
- Raw `cargo build` wasm output is rejected by the Stellar network (LEB128/reference-types issue) — always run `stellar contract optimize` on the wasm before `deploy`.
- The workspace Orval config forces `info.title: Api` — do not rename it or generated filenames will break.
- Query params that match `<OperationIdPascal>Params` pattern cause TS2308 collisions in codegen — define them without query params or use path params instead.
- `dlmmPoolId`/`protocolFeeBps`/`lpFeeBps`/`isLaunchPool`/`activationTs` are only present on DLMM-category pools (both `Pool` list items and `PoolDetail`) — AMM pools from the Stellar DEX never have them.
- Real wallet signing (Freighter/Albedo) can't be exercised by automated screenshot/e2e tooling since it requires a real browser extension; verify contract correctness via direct CLI/RPC calls instead.
- Every DLMM contract storage key (Config, Active, LastTs, Bin, AllBins, Share, TotalShare, UserBins) is namespaced by `pool_id` — when adding new contract functionality, always thread `pool_id` through storage keys or data will leak across pools.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
