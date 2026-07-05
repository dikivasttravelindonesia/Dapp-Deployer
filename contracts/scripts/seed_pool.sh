#!/usr/bin/env bash
# Reusable seed script for the StellarBin DLMM multi-pool registry contract.
#
# Creates a pool (Standard Pool by default; pass an activation timestamp for
# a Launch Pool) and seeds it with liquidity across 5 bins so the UI has
# realistic bin-distribution data to render immediately.
#
# Usage:
#   ./seed_pool.sh                       # create + seed the default XLM/TESTUSD Standard Pool
#   ACTIVATION_TS=$(date -d '+1 hour' +%s) ./seed_pool.sh   # create a Launch Pool instead
#
# Requires: `stellar` CLI on PATH, `deployer` + `holder` identities configured
# (see .config/stellar/identity/), and contracts/.env populated with the
# deployed DLMM_CONTRACT_ID + token addresses.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
source .env
set +a

export PATH="$HOME/.cargo/bin:$PATH"

DEPLOYER_KEY="deployer"
HOLDER_KEY="holder"
HOLDER_ADDRESS="$(stellar keys address "$HOLDER_KEY")"
DEPLOYER_PUB="$(stellar keys address "$DEPLOYER_KEY")"

BIN_STEP_BPS="${BIN_STEP_BPS:-25}"
BASE_FEE_BPS="${BASE_FEE_BPS:-10}"
ACTIVE_BIN_ID="${ACTIVE_BIN_ID:-0}"
ACTIVATION_TS="${ACTIVATION_TS:-0}"

echo "==> Creating pool (bin_step=${BIN_STEP_BPS}bps, base_fee=${BASE_FEE_BPS}bps, activation_ts=${ACTIVATION_TS})"
POOL_ID=$(stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$DEPLOYER_KEY" --send=yes -- create_pool \
  --creator "$DEPLOYER_PUB" \
  --token_x "$TOKEN_X_ADDRESS" --token_y "$TOKEN_Y_ADDRESS" \
  --bin_step_bps "$BIN_STEP_BPS" --base_fee_bps "$BASE_FEE_BPS" \
  --active_bin_id "$ACTIVE_BIN_ID" --activation_ts "$ACTIVATION_TS" | tail -1)

echo "==> Created pool_id=${POOL_ID}"

echo "==> Seeding active bin (${ACTIVE_BIN_ID}) with both tokens"
stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$HOLDER_KEY" --send=yes -- add_liquidity_bin \
  --pool_id "$POOL_ID" --caller "$HOLDER_ADDRESS" --bin_id "$ACTIVE_BIN_ID" --amount_x 5000000000 --amount_y 500000000

echo "==> Seeding bin $((ACTIVE_BIN_ID + 1)) (token X only)"
stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$HOLDER_KEY" --send=yes -- add_liquidity_bin \
  --pool_id "$POOL_ID" --caller "$HOLDER_ADDRESS" --bin_id $((ACTIVE_BIN_ID + 1)) --amount_x 3000000000 --amount_y 0

echo "==> Seeding bin $((ACTIVE_BIN_ID + 2)) (token X only)"
stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$HOLDER_KEY" --send=yes -- add_liquidity_bin \
  --pool_id "$POOL_ID" --caller "$HOLDER_ADDRESS" --bin_id $((ACTIVE_BIN_ID + 2)) --amount_x 2000000000 --amount_y 0

echo "==> Seeding bin $((ACTIVE_BIN_ID - 1)) (token Y only)"
stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$HOLDER_KEY" --send=yes -- add_liquidity_bin \
  --pool_id "$POOL_ID" --caller "$HOLDER_ADDRESS" --bin_id $((ACTIVE_BIN_ID - 1)) --amount_x 0 --amount_y 300000000

echo "==> Seeding bin $((ACTIVE_BIN_ID - 2)) (token Y only)"
stellar contract invoke --id "$DLMM_CONTRACT_ID" --network "$STELLAR_NETWORK" --source "$HOLDER_KEY" --send=yes -- add_liquidity_bin \
  --pool_id "$POOL_ID" --caller "$HOLDER_ADDRESS" --bin_id $((ACTIVE_BIN_ID - 2)) --amount_x 0 --amount_y 200000000

echo "==> Done. pool_id=${POOL_ID}"
