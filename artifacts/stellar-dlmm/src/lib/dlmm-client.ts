/**
 * Real on-chain client for the deployed DLMM Soroban contract.
 *
 * Quotes are obtained via read-only simulation (no wallet required).
 * Swaps are built, simulated+assembled with `prepareTransaction`, signed by
 * the connected wallet (Freighter/Albedo), and submitted to the network —
 * no mocked data anywhere in this path.
 */

import {
  Address,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  createRpcServer,
  addressToScVal,
  i32ToScVal,
  i128ToScVal,
  boolToScVal,
  NETWORK_CONFIG,
  decodeSwapResult,
  type SwapResultDecoded,
} from "./stellar";
import { DLMM_CONTRACT_ID, STELLAR_NETWORK } from "./contracts";

// A funded, publicly-known testnet account used only to satisfy Soroban's
// requirement for a transaction source account when simulating read-only
// calls (e.g. quotes) before a wallet is connected. No funds move and no
// signature is required for read-only invocations.
const QUOTE_SOURCE_ACCOUNT =
  import.meta.env.VITE_QUOTE_SOURCE_ACCOUNT ??
  "GD3HFFCVSBBQSHHXJGJLSRCAFTGRT5XFHSGCC2U7BDKBFPQWZWITDWQ2";

export interface SwapQuote {
  amountOut: bigint;
  feePaid: bigint;
  binsCrossed: number;
  finalBin: number;
}

/**
 * Read-only quote via `simulate_swap` — a real contract call against live
 * on-chain bin reserves, not a client-side estimate.
 */
export async function getOnChainSwapQuote(
  xToY: boolean,
  amountIn: bigint
): Promise<SwapQuote> {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const account = await rpcServer.getAccount(QUOTE_SOURCE_ACCOUNT);
  const contract = new Contract(DLMM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase,
  })
    .addOperation(
      contract.call("simulate_swap", boolToScVal(xToY), i128ToScVal(amountIn))
    )
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Quote simulation failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error("Quote simulation returned no result");
  }

  const decoded = decodeSwapResult(sim.result.retval);
  return decoded;
}

/**
 * Builds, prepares (simulate + assemble footprint/auth), and returns an
 * unsigned transaction for `swap_exact_in_bin`. Caller must sign via wallet
 * and submit with `submitSignedSwap`.
 */
export async function buildSwapTransaction(
  callerAddress: string,
  xToY: boolean,
  amountIn: bigint,
  minAmountOut: bigint
) {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const account = await rpcServer.getAccount(callerAddress);
  const contract = new Contract(DLMM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase,
  })
    .addOperation(
      contract.call(
        "swap_exact_in_bin",
        addressToScVal(callerAddress),
        boolToScVal(xToY),
        i128ToScVal(amountIn),
        i128ToScVal(minAmountOut)
      )
    )
    .setTimeout(60)
    .build();

  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared;
}

/**
 * Submits a wallet-signed transaction XDR and polls until it lands
 * (SUCCESS/FAILED), returning the decoded SwapResult on success.
 */
export async function submitSignedSwap(signedXdr: string): Promise<SwapResultDecoded> {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const networkPassphrase = NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase;
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const sendResult = await rpcServer.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction rejected: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const hash = sendResult.hash;
  let getResult = await rpcServer.getTransaction(hash);
  const start = Date.now();
  while (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() - start > 30_000) {
      throw new Error(`Timed out waiting for transaction ${hash} to confirm`);
    }
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await rpcServer.getTransaction(hash);
  }

  if (getResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${JSON.stringify(getResult)}`);
  }

  if (!getResult.returnValue) {
    throw new Error("Transaction succeeded but returned no value");
  }

  return decodeSwapResult(getResult.returnValue);
}

export function toAddressScVal(address: string) {
  return Address.fromString(address).toScVal();
}

export function decodeI128(val: unknown): bigint {
  return scValToNative(val as any) as bigint;
}

/** Builds a prepared (simulated + assembled) `add_liquidity_bin` transaction. */
export async function buildAddLiquidityTransaction(
  callerAddress: string,
  binId: number,
  amountX: bigint,
  amountY: bigint
) {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const account = await rpcServer.getAccount(callerAddress);
  const contract = new Contract(DLMM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase,
  })
    .addOperation(
      contract.call(
        "add_liquidity_bin",
        addressToScVal(callerAddress),
        i32ToScVal(binId),
        i128ToScVal(amountX),
        i128ToScVal(amountY)
      )
    )
    .setTimeout(60)
    .build();

  return rpcServer.prepareTransaction(tx);
}

/** Builds a prepared (simulated + assembled) `remove_liquidity_bin` transaction. */
export async function buildRemoveLiquidityTransaction(callerAddress: string, binId: number) {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const account = await rpcServer.getAccount(callerAddress);
  const contract = new Contract(DLMM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase,
  })
    .addOperation(
      contract.call("remove_liquidity_bin", addressToScVal(callerAddress), i32ToScVal(binId))
    )
    .setTimeout(60)
    .build();

  return rpcServer.prepareTransaction(tx);
}

/** Submits a wallet-signed XDR and waits for confirmation. Returns the raw ScVal return value. */
export async function submitSignedTransaction(signedXdr: string) {
  const rpcServer = createRpcServer(STELLAR_NETWORK);
  const networkPassphrase = NETWORK_CONFIG[STELLAR_NETWORK].networkPassphrase;
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const sendResult = await rpcServer.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction rejected: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const hash = sendResult.hash;
  let getResult = await rpcServer.getTransaction(hash);
  const start = Date.now();
  while (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() - start > 30_000) {
      throw new Error(`Timed out waiting for transaction ${hash} to confirm`);
    }
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await rpcServer.getTransaction(hash);
  }

  if (getResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${JSON.stringify(getResult)}`);
  }

  return getResult.returnValue;
}
