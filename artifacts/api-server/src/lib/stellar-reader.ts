/**
 * Real on-chain / on-network data reader for the Pools & Positions pages.
 *
 * Two live sources, no mock data:
 *   1. Our deployed DLMM Soroban contract — read via read-only RPC simulation
 *      (get_config / get_active_bin / get_bins / get_positions). No signing.
 *   2. Native Stellar DEX liquidity pools — read from Horizon /liquidity_pools
 *      (the "AMM from Stellar DEX" aggregator category).
 *
 * USD valuation uses the real XLM spot price from CoinGecko. Any figure we do
 * not actually index on-chain (24h volume / fees / APR) is reported as
 * unavailable (volumeAvailable=false) rather than fabricated.
 */

import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Config (public testnet values; overridable via env)
// ---------------------------------------------------------------------------

const RPC_URL = process.env["STELLAR_RPC_URL"] ?? "https://soroban-testnet.stellar.org";
const HORIZON_URL = process.env["STELLAR_HORIZON_URL"] ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const DLMM_CONTRACT_ID =
  process.env["DLMM_CONTRACT_ID"] ?? "CAWVYZS7FXVSOXTE7DBUULYOHCWVA2RML4CHXOETGS32FOBCOZ7YH4RS";
const TESTUSD_SAC =
  process.env["TOKEN_Y_ADDRESS"] ?? "CCA733ILFGI7SESYWNBYTKHUJTJTSU2ORRT6SFNSDZWHYSE4WDLLDUND";

// A funded, publicly-known testnet account used only to satisfy Soroban's
// requirement for a source account when simulating read-only calls. No funds
// move and no signature is required for read-only invocations.
const SOURCE_ACCOUNT =
  process.env["QUOTE_SOURCE_ACCOUNT"] ?? "GD3HFFCVSBBQSHHXJGJLSRCAFTGRT5XFHSGCC2U7BDKBFPQWZWITDWQ2";

export const DLMM_POOL_ID = "pool-xlm-testusd-live";

const SCALAR = 7; // token decimals (stroops → display units = 10^7)
const XLM_LOGO =
  "https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png";
const USD_LOGO = "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png";

// ---------------------------------------------------------------------------
// Types mirroring the OpenAPI schemas we produce
// ---------------------------------------------------------------------------

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price: number;
  priceChange24h?: number;
  logoUrl: string;
}

export interface PoolRecord {
  id: string;
  category: "dlmm" | "amm";
  tokenX: Token;
  tokenY: Token;
  tvl: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  binStep: number;
  activeBinId: number;
  currentPrice?: number;
  fee?: number;
  reserveX?: number;
  reserveY?: number;
  totalShares?: number;
  externalUrl?: string;
  volumeAvailable: boolean;
  contractAddress?: string;
  totalBins?: number;
}

export interface BinRecord {
  binId: number;
  price: number;
  liquidityX: number;
  liquidityY: number;
  isActive: boolean;
  totalLiquidity: number;
}

export interface PositionRecord {
  id: string;
  poolId: string;
  pool: PoolRecord;
  address: string;
  binId: number;
  binRangeLow: number;
  binRangeHigh: number;
  shares: number;
  liquidityX: number;
  liquidityY: number;
  valueUsd: number;
  unrealizedFees: number;
}

// ---------------------------------------------------------------------------
// Small TTL caches
// ---------------------------------------------------------------------------

function memoize<T>(ttlMs: number, fn: () => Promise<T>): () => Promise<T> {
  let value: T | undefined;
  let expiresAt = 0;
  return async () => {
    if (value !== undefined && Date.now() < expiresAt) return value;
    value = await fn();
    expiresAt = Date.now() + ttlMs;
    return value;
  };
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

function fromStroops(v: bigint | number): number {
  return Number(v) / 10 ** SCALAR;
}

/** DLMM bin price: (1 + binStep/10000)^binId, matching the contract's curve. */
function binPrice(binStepBps: number, binId: number): number {
  return Math.pow(1 + binStepBps / 10_000, binId);
}

// ---------------------------------------------------------------------------
// Soroban RPC (read-only simulation)
// ---------------------------------------------------------------------------

let rpcServer: rpc.Server | null = null;
function getRpc(): rpc.Server {
  if (!rpcServer) rpcServer = new rpc.Server(RPC_URL, { allowHttp: false });
  return rpcServer;
}

async function simRead(fn: string, args: xdr.ScVal[] = []): Promise<unknown> {
  const server = getRpc();
  const account = await server.getAccount(SOURCE_ACCOUNT);
  const contract = new Contract(DLMM_CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`DLMM ${fn} simulation failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`DLMM ${fn} simulation returned no result`);
  }
  return scValToNative(sim.result.retval);
}

interface RawConfig {
  admin: string;
  token_x: string;
  token_y: string;
  bin_step_bps: bigint | number;
  base_fee_bps: bigint | number;
}
interface RawBin {
  bin_id: number;
  reserve_x: bigint;
  reserve_y: bigint;
}
interface RawPosition {
  bin_id: number;
  shares: bigint;
  total_shares: bigint;
  amount_x: bigint;
  amount_y: bigint;
}

// ---------------------------------------------------------------------------
// XLM spot price (CoinGecko), cached
// ---------------------------------------------------------------------------

const getXlmPrice = memoize(60_000, async (): Promise<number> => {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) throw new Error(`CoinGecko price fetch failed: ${res.status}`);
  const json = (await res.json()) as { stellar?: { usd?: number } };
  const price = json.stellar?.usd;
  if (typeof price !== "number" || !(price > 0)) {
    throw new Error("CoinGecko returned no usable XLM price");
  }
  return price;
});

// ---------------------------------------------------------------------------
// Token builders
// ---------------------------------------------------------------------------

function xlmToken(price: number): Token {
  return {
    symbol: "XLM",
    name: "Stellar Lumens",
    address: "native",
    decimals: 7,
    price,
    priceChange24h: 0,
    logoUrl: XLM_LOGO,
  };
}

function testUsdToken(): Token {
  return {
    symbol: "TESTUSD",
    name: "Test USD (testnet SAC)",
    address: TESTUSD_SAC,
    decimals: 7,
    price: 1,
    priceChange24h: 0,
    logoUrl: USD_LOGO,
  };
}

// ---------------------------------------------------------------------------
// DLMM pool (our contract) — real on-chain reads
// ---------------------------------------------------------------------------

async function readDlmmPool(): Promise<PoolRecord> {
  const [config, activeBinRaw, binsRaw, xlmPrice] = await Promise.all([
    simRead("get_config") as Promise<RawConfig>,
    simRead("get_active_bin") as Promise<number>,
    simRead("get_bins") as Promise<RawBin[]>,
    getXlmPrice(),
  ]);

  const binStep = Number(config.bin_step_bps);
  const baseFeeBps = Number(config.base_fee_bps);
  const activeBinId = Number(activeBinRaw);

  let reserveX = 0;
  let reserveY = 0;
  for (const b of binsRaw) {
    reserveX += fromStroops(b.reserve_x);
    reserveY += fromStroops(b.reserve_y);
  }

  const tvl = reserveX * xlmPrice + reserveY; // TESTUSD ≈ $1

  return {
    id: DLMM_POOL_ID,
    category: "dlmm",
    tokenX: xlmToken(xlmPrice),
    tokenY: testUsdToken(),
    tvl,
    volume24h: 0,
    fees24h: 0,
    apr: 0,
    binStep,
    activeBinId,
    currentPrice: binPrice(binStep, activeBinId),
    fee: baseFeeBps / 10_000,
    reserveX,
    reserveY,
    volumeAvailable: false,
    contractAddress: DLMM_CONTRACT_ID,
    totalBins: binsRaw.length,
  };
}

const getDlmmPool = memoize(30_000, readDlmmPool);

/** Real bin distribution for the DLMM pool from get_bins. */
async function readDlmmBins(): Promise<BinRecord[]> {
  const [config, activeBinRaw, binsRaw, xlmPrice] = await Promise.all([
    simRead("get_config") as Promise<RawConfig>,
    simRead("get_active_bin") as Promise<number>,
    simRead("get_bins") as Promise<RawBin[]>,
    getXlmPrice(),
  ]);
  const binStep = Number(config.bin_step_bps);
  const activeBinId = Number(activeBinRaw);

  return binsRaw
    .map((b) => {
      const binId = Number(b.bin_id);
      const liquidityX = fromStroops(b.reserve_x);
      const liquidityY = fromStroops(b.reserve_y);
      const price = binPrice(binStep, binId);
      return {
        binId,
        price,
        liquidityX,
        liquidityY,
        isActive: binId === activeBinId,
        totalLiquidity: liquidityX * xlmPrice + liquidityY,
      };
    })
    .sort((a, b) => a.binId - b.binId);
}

const getDlmmBins = memoize(30_000, readDlmmBins);

/** Real per-user LP positions from get_positions. Empty array if none. */
export async function getUserPositions(address: string): Promise<PositionRecord[]> {
  let addressScVal: xdr.ScVal;
  try {
    addressScVal = Address.fromString(address).toScVal();
  } catch {
    return [];
  }

  const [positionsRaw, pool, xlmPrice] = await Promise.all([
    simRead("get_positions", [addressScVal]) as Promise<RawPosition[]>,
    getDlmmPool(),
    getXlmPrice(),
  ]);

  return positionsRaw
    .map((p) => {
      const binId = Number(p.bin_id);
      const liquidityX = fromStroops(p.amount_x);
      const liquidityY = fromStroops(p.amount_y);
      return {
        id: `${address.slice(0, 6)}-bin${binId}`,
        poolId: DLMM_POOL_ID,
        pool,
        address,
        binId,
        binRangeLow: binId,
        binRangeHigh: binId,
        shares: fromStroops(p.shares),
        liquidityX,
        liquidityY,
        valueUsd: liquidityX * xlmPrice + liquidityY,
        // Trading fees auto-compound into a bin's reserves in this model, so a
        // position's claimable amount already includes accrued fees — there is
        // no separately-tracked "unrealized fee" balance to report.
        unrealizedFees: 0,
      };
    })
    .sort((a, b) => a.binId - b.binId);
}

// ---------------------------------------------------------------------------
// AMM pools (native Stellar DEX) — Horizon aggregator
// ---------------------------------------------------------------------------

interface HorizonReserve {
  asset: string;
  amount: string;
}
interface HorizonPool {
  id: string;
  fee_bp: number;
  total_shares: string;
  reserves: HorizonReserve[];
}

function parseAsset(asset: string, xlmPrice: number): Token {
  if (asset === "native") return xlmToken(xlmPrice);
  const [code, issuer] = asset.split(":");
  return {
    symbol: code ?? asset,
    name: code ?? asset,
    address: issuer ?? asset,
    decimals: 7,
    price: 0, // arbitrary testnet asset — no reliable USD price
    priceChange24h: 0,
    logoUrl: "",
  };
}

async function readAmmPools(): Promise<PoolRecord[]> {
  const xlmPrice = await getXlmPrice();
  const res = await fetch(`${HORIZON_URL}/liquidity_pools?limit=200&order=desc`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Horizon liquidity_pools fetch failed: ${res.status}`);
  const json = (await res.json()) as { _embedded?: { records?: HorizonPool[] } };
  const records = json._embedded?.records ?? [];

  const pools: PoolRecord[] = [];
  for (const r of records) {
    if (!Array.isArray(r.reserves) || r.reserves.length !== 2) continue;
    const nativeIdx = r.reserves.findIndex((x) => x.asset === "native");
    if (nativeIdx === -1) continue; // only pools we can value in USD (contain XLM)

    const nativeAmt = parseFloat(r.reserves[nativeIdx]!.amount);
    const other = r.reserves[1 - nativeIdx]!;
    const otherAmt = parseFloat(other.amount);
    if (!(nativeAmt > 0) || !(otherAmt > 0)) continue;

    // Constant-product pools hold equal value on both sides, so TVL ≈ 2× the
    // XLM side valued at spot. This is a real figure, not a fabricated one.
    const tvl = 2 * nativeAmt * xlmPrice;

    pools.push({
      id: r.id,
      category: "amm",
      tokenX: xlmToken(xlmPrice),
      tokenY: parseAsset(other.asset, xlmPrice),
      tvl,
      volume24h: 0,
      fees24h: 0,
      apr: 0,
      binStep: 0,
      activeBinId: 0,
      currentPrice: otherAmt / nativeAmt,
      fee: (r.fee_bp ?? 30) / 10_000,
      reserveX: nativeAmt,
      reserveY: otherAmt,
      totalShares: parseFloat(r.total_shares),
      externalUrl: `https://stellar.expert/explorer/testnet/liquidity-pool/${r.id}`,
      volumeAvailable: false,
    });
  }

  pools.sort((a, b) => b.tvl - a.tvl);
  return pools.slice(0, 12);
}

const getAmmPools = memoize(60_000, readAmmPools);

// ---------------------------------------------------------------------------
// Public aggregation API
// ---------------------------------------------------------------------------

export async function getAllPools(): Promise<PoolRecord[]> {
  const [dlmm, amm] = await Promise.all([getDlmmPool(), getAmmPools()]);
  return [dlmm, ...amm];
}

export async function getPoolById(poolId: string): Promise<PoolRecord | null> {
  if (poolId === DLMM_POOL_ID) return getDlmmPool();
  const amm = await getAmmPools();
  return amm.find((p) => p.id === poolId) ?? null;
}

export async function getPoolBins(poolId: string): Promise<BinRecord[] | null> {
  if (poolId !== DLMM_POOL_ID) return null; // only the DLMM pool has discrete bins
  return getDlmmBins();
}

export async function getProtocolSummary() {
  const pools = await getAllPools();
  return {
    totalTvl: pools.reduce((s, p) => s + p.tvl, 0),
    totalVolume24h: 0,
    totalFees24h: 0,
    totalPools: pools.length,
    totalTransactions24h: 0,
  };
}
