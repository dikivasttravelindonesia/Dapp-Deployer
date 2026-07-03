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
- **Pools** (`/pools`): Sortable/searchable pool table with protocol summary stats bar
- **Pool Detail** (`/pools/:poolId`): DLMM bin distribution chart (Recharts), TVL/volume/fees history chart, Add/Remove liquidity modals with strategy presets (Spot, Curve, Bid-Ask)
- **Positions** (`/positions`): LP position cards with bin range, unrealized fees, strategy badge
- **Analytics** (`/analytics`): Protocol-wide TVL/volume charts, top pools, recent transaction feed

## Smart Contracts (Soroban / Rust)

Located in `contracts/`. Compile with:
```bash
cd contracts && cargo build --target wasm32-unknown-unknown --release
```
Deploy with the Stellar CLI:
```bash
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/stellar_dlmm.wasm --network testnet
```

## Gotchas

- After any OpenAPI spec change, run codegen before modifying routes or frontend hooks.
- The `@stellar/stellar-sdk` package must be added to `artifacts/stellar-dlmm/package.json` before using `src/lib/stellar.ts` in components (`pnpm --filter @workspace/stellar-dlmm add @stellar/stellar-sdk`).
- Soroban contracts require Rust nightly + `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`.
- The workspace Orval config forces `info.title: Api` — do not rename it or generated filenames will break.
- Query params that match `<OperationIdPascal>Params` pattern cause TS2308 collisions in codegen — define them without query params or use path params instead.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
