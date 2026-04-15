import type { Pool, PoolClient } from "pg";
import { BigNumber, utils } from "ethers";
import type { ethers } from "ethers";

const log = require("../../utils/logger")("utils:nonceQueueTxLifecycle");

const GWEI = BigNumber.from(1_000_000_000);
const DEFAULT_PRIORITY_FEE = GWEI.mul(2);
const DEFAULT_GAS_PRICE = GWEI.mul(20);

export interface SubmitNonceQueuedTxParams {
  sendTransaction: (
    transaction: Parameters<ethers.Signer["sendTransaction"]>[0]
  ) => Promise<ethers.providers.TransactionResponse>;
  provider?: ethers.providers.Provider;
  transaction: Parameters<ethers.Signer["sendTransaction"]>[0];
  nonce: number;
  signerAddress: string;
  chainId: number;
}

interface TxLifecycleConfig {
  txConfirmTimeoutS: number;
  receiptPollS: number;
  rebroadcastIntervalS: number;
  replaceIntervalS: number;
  maxReplacements: number;
  feeBumpPct: number;
  gasLimitBufferPct: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIntEnv(
  name: string,
  fallback: number,
  minimum = 0,
  maximum?: number
): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  const withinMax = maximum === undefined || parsed <= maximum;
  if (!Number.isInteger(parsed) || parsed < minimum || !withinMax) {
    const maxMsg = maximum === undefined ? "" : ` and <= ${maximum}`;
    log(
      `Invalid ${name}="${value}" (expected integer >= ${minimum}${maxMsg}). Falling back to ${fallback}.`
    );
    return fallback;
  }
  return parsed;
}

function getTxLifecycleConfig(): TxLifecycleConfig {
  return {
    txConfirmTimeoutS: parseIntEnv("NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S", 600),
    receiptPollS: parseIntEnv("NONCE_QUEUE_RECEIPT_POLL_S", 5, 1),
    rebroadcastIntervalS: parseIntEnv("NONCE_QUEUE_REBROADCAST_INTERVAL_S", 30),
    replaceIntervalS: parseIntEnv("NONCE_QUEUE_REPLACE_INTERVAL_S", 90),
    maxReplacements: parseIntEnv("NONCE_QUEUE_MAX_REPLACEMENTS", 3),
    feeBumpPct: parseIntEnv("NONCE_QUEUE_FEE_BUMP_PCT", 15, 0, 500),
    gasLimitBufferPct: parseIntEnv(
      "NONCE_QUEUE_GAS_LIMIT_BUFFER_PCT",
      0,
      0,
      500
    ),
  };
}

function secondsToMs(seconds: number): number {
  return seconds * 1_000;
}

function asBigNumber(value: any): BigNumber | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return BigNumber.from(value);
  } catch {
    return undefined;
  }
}

function bumpByPercent(value: BigNumber, percent: number): BigNumber {
  if (percent === 0) return value;
  return value
    .mul(100 + percent)
    .add(99)
    .div(100);
}

function maxBigNumber(a: BigNumber, b: BigNumber): BigNumber {
  return a.gte(b) ? a : b;
}

function getTxCapComparableGasPrice(
  transaction: Parameters<ethers.Signer["sendTransaction"]>[0]
): BigNumber | undefined {
  // For EIP-1559, maxFeePerGas is the effective ceiling; for legacy tx use gasPrice.
  return (
    asBigNumber(transaction.maxFeePerGas) ?? asBigNumber(transaction.gasPrice)
  );
}

async function applyGasLimitBuffer({
  transaction,
  provider,
  gasLimitBufferPct,
  signerAddress,
  chainId,
  nonce,
  stage,
}: {
  transaction: Parameters<ethers.Signer["sendTransaction"]>[0];
  provider?: ethers.providers.Provider;
  gasLimitBufferPct: number;
  signerAddress: string;
  chainId: number;
  nonce: number;
  stage: "initial submission" | "replacement";
}): Promise<Parameters<ethers.Signer["sendTransaction"]>[0]> {
  if (gasLimitBufferPct <= 0) return transaction;
  if (!provider || typeof provider.estimateGas !== "function")
    return transaction;

  const estimateRequest: Parameters<
    ethers.providers.Provider["estimateGas"]
  >[0] = {
    ...transaction,
    from: signerAddress,
  };
  if (estimateRequest.nonce === undefined) {
    estimateRequest.nonce = nonce;
  }

  const estimatedGas = await provider
    .estimateGas(estimateRequest)
    .catch((err) => {
      log(
        `Failed to estimate gas for ${stage}; skipping NONCE_QUEUE_GAS_LIMIT_BUFFER_PCT: address=${signerAddress} chain=${chainId} nonce=${nonce} error="${
          err?.message ?? String(err)
        }"`
      );
      return null;
    });
  if (!estimatedGas) return transaction;

  const bufferedGasLimit = bumpByPercent(estimatedGas, gasLimitBufferPct);
  const configuredGasLimit = asBigNumber(transaction.gasLimit);
  const finalGasLimit = configuredGasLimit
    ? maxBigNumber(configuredGasLimit, bufferedGasLimit)
    : bufferedGasLimit;

  if (configuredGasLimit && finalGasLimit.eq(configuredGasLimit)) {
    return transaction;
  }

  return {
    ...transaction,
    gasLimit: finalGasLimit,
  };
}

function getPerChainMaxGasPriceEnvKey(chainId: number): string {
  return `NONCE_QUEUE_MAX_GAS_PRICE_GWEI_CHAIN_${chainId}`;
}

function resolveMaxGasPriceWeiForChain(chainId: number): BigNumber | null {
  const envKey = getPerChainMaxGasPriceEnvKey(chainId);
  const value = process.env[envKey];
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    log(
      `Invalid ${envKey}="${value}" (expected integer >= 0). Gas cap disabled for chain ${chainId}.`
    );
    return null;
  }
  if (parsed === 0) return null;
  return GWEI.mul(parsed);
}

function assertWithinGasPriceCap({
  priceWei,
  maxGasPriceWei,
  maxGasPriceEnvKey,
  stage,
  signerAddress,
  chainId,
  nonce,
}: {
  priceWei: BigNumber;
  maxGasPriceWei: BigNumber;
  maxGasPriceEnvKey: string;
  stage: "initial submission" | "rebroadcast" | "replacement";
  signerAddress: string;
  chainId: number;
  nonce: number;
}) {
  if (priceWei.lte(maxGasPriceWei)) return;
  throw new Error(
    `Nonce queue gas price cap exceeded during ${stage}: address=${signerAddress} chain=${chainId} nonce=${nonce} gasPrice=${priceWei.toString()} wei cap=${maxGasPriceWei.toString()} wei (set by ${maxGasPriceEnvKey})`
  );
}

async function enforceSubmissionGasPriceCap({
  transaction,
  provider,
  maxGasPriceWei,
  maxGasPriceEnvKey,
  stage,
  signerAddress,
  chainId,
  nonce,
}: {
  transaction: Parameters<ethers.Signer["sendTransaction"]>[0];
  provider?: ethers.providers.Provider;
  maxGasPriceWei: BigNumber | null;
  maxGasPriceEnvKey: string;
  stage: "initial submission" | "replacement";
  signerAddress: string;
  chainId: number;
  nonce: number;
}) {
  if (!maxGasPriceWei) return;

  // Prefer explicit tx fee fields. If missing, query network fee data so the cap
  // still applies to transactions where callers omitted fee overrides.
  let comparableGasPrice = getTxCapComparableGasPrice(transaction);
  if (!comparableGasPrice && provider) {
    const feeData = await provider.getFeeData().catch(() => null);
    comparableGasPrice =
      asBigNumber(feeData?.maxFeePerGas) ?? asBigNumber(feeData?.gasPrice);
  }

  if (!comparableGasPrice) {
    throw new Error(
      `Unable to enforce ${maxGasPriceEnvKey} for ${stage}: address=${signerAddress} chain=${chainId} nonce=${nonce} transaction has no gasPrice/maxFeePerGas and provider fee data is unavailable`
    );
  }

  assertWithinGasPriceCap({
    priceWei: comparableGasPrice,
    maxGasPriceWei,
    maxGasPriceEnvKey,
    stage,
    signerAddress,
    chainId,
    nonce,
  });
}

function enforceRebroadcastGasPriceCap({
  rawTransaction,
  maxGasPriceWei,
  maxGasPriceEnvKey,
  signerAddress,
  chainId,
  nonce,
}: {
  rawTransaction: string;
  maxGasPriceWei: BigNumber | null;
  maxGasPriceEnvKey: string;
  signerAddress: string;
  chainId: number;
  nonce: number;
}) {
  if (!maxGasPriceWei) return;

  // Rebroadcast path operates on raw signed tx bytes. Parse them to recover
  // gas settings and enforce the same cap policy before re-sending.
  const parsedTransaction = utils.parseTransaction(rawTransaction);
  const comparableGasPrice =
    asBigNumber(parsedTransaction.maxFeePerGas) ??
    asBigNumber(parsedTransaction.gasPrice);

  if (!comparableGasPrice) {
    throw new Error(
      `Unable to enforce ${maxGasPriceEnvKey} for rebroadcast: address=${signerAddress} chain=${chainId} nonce=${nonce} raw transaction has no gasPrice/maxFeePerGas`
    );
  }

  assertWithinGasPriceCap({
    priceWei: comparableGasPrice,
    maxGasPriceWei,
    maxGasPriceEnvKey,
    stage: "rebroadcast",
    signerAddress,
    chainId,
    nonce,
  });
}

function extractRawTransaction(
  response: ethers.providers.TransactionResponse
): string | undefined {
  const candidate = (response as any).raw ?? (response as any).rawTransaction;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
}

function isDuplicateBroadcastError(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("already known") ||
    msg.includes("known transaction") ||
    msg.includes("already imported")
  );
}

async function findMinedReceipt(
  provider: ethers.providers.Provider,
  hashes: string[]
) {
  for (const hash of hashes) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
  }
  return null;
}

async function buildReplacementTransaction(
  transaction: Parameters<ethers.Signer["sendTransaction"]>[0],
  provider: ethers.providers.Provider,
  feeBumpPct: number
): Promise<Parameters<ethers.Signer["sendTransaction"]>[0]> {
  const feeData = await provider.getFeeData().catch(() => null);
  const nextTx: Parameters<ethers.Signer["sendTransaction"]>[0] = {
    ...transaction,
  };

  const hasEip1559Fees =
    nextTx.maxFeePerGas !== undefined ||
    nextTx.maxPriorityFeePerGas !== undefined ||
    nextTx.type === 2;

  if (hasEip1559Fees) {
    // Keep replacement monotonic: bump previous fee settings and never go below
    // current network recommendations.
    const basePriority =
      asBigNumber(nextTx.maxPriorityFeePerGas) ??
      asBigNumber(feeData?.maxPriorityFeePerGas) ??
      DEFAULT_PRIORITY_FEE;
    const baseMaxFee =
      asBigNumber(nextTx.maxFeePerGas) ??
      asBigNumber(feeData?.maxFeePerGas) ??
      basePriority.mul(2);

    const bumpedPriority = bumpByPercent(basePriority, feeBumpPct);
    const bumpedMaxFee = bumpByPercent(baseMaxFee, feeBumpPct);
    const networkPriority = asBigNumber(feeData?.maxPriorityFeePerGas);
    const networkMaxFee = asBigNumber(feeData?.maxFeePerGas);

    let finalPriority = bumpedPriority;
    let finalMaxFee = bumpedMaxFee;
    if (networkPriority) {
      finalPriority = maxBigNumber(finalPriority, networkPriority);
    }
    if (networkMaxFee) {
      finalMaxFee = maxBigNumber(finalMaxFee, networkMaxFee);
    }
    if (finalMaxFee.lt(finalPriority)) {
      finalMaxFee = finalPriority;
    }

    delete nextTx.gasPrice;
    nextTx.maxPriorityFeePerGas = finalPriority;
    nextTx.maxFeePerGas = finalMaxFee;
    nextTx.type = 2;
    return nextTx;
  }

  const baseGasPrice =
    asBigNumber(nextTx.gasPrice) ??
    asBigNumber(feeData?.gasPrice) ??
    DEFAULT_GAS_PRICE;
  // Legacy path: bump prior gasPrice and floor at current network gasPrice.
  const networkGasPrice = asBigNumber(feeData?.gasPrice);
  let finalGasPrice = bumpByPercent(baseGasPrice, feeBumpPct);
  if (networkGasPrice) {
    finalGasPrice = maxBigNumber(finalGasPrice, networkGasPrice);
  }
  nextTx.gasPrice = finalGasPrice;
  return nextTx;
}

/**
 * Send a nonce-pinned transaction and wait for on-chain confirmation.
 * Future resend / replacement strategy should stay in this file.
 */
export async function submitNonceQueuedTransaction({
  sendTransaction,
  provider,
  transaction,
  nonce,
  signerAddress,
  chainId,
}: SubmitNonceQueuedTxParams): Promise<ethers.providers.TransactionResponse> {
  const config = getTxLifecycleConfig();
  const maxGasPriceEnvKey = getPerChainMaxGasPriceEnvKey(chainId);
  // The lifecycle intentionally ignores the legacy global cap and only reads
  // per-chain caps, so operators can tune limits independently per network.
  const maxGasPriceWei = resolveMaxGasPriceWeiForChain(chainId);
  let initialTx: Parameters<ethers.Signer["sendTransaction"]>[0] = {
    ...transaction,
    nonce,
  };

  // Apply optional global gas-limit headroom over provider estimate to reduce
  // under-estimation failures during volatile state changes.
  initialTx = await applyGasLimitBuffer({
    transaction: initialTx,
    provider,
    gasLimitBufferPct: config.gasLimitBufferPct,
    signerAddress,
    chainId,
    nonce,
    stage: "initial submission",
  });

  // Enforce fee cap before any on-chain submission.
  await enforceSubmissionGasPriceCap({
    transaction: initialTx,
    provider,
    maxGasPriceWei,
    maxGasPriceEnvKey,
    stage: "initial submission",
    signerAddress,
    chainId,
    nonce,
  });

  const firstResponse = await sendTransaction(initialTx);
  const responsesByHash = new Map<string, ethers.providers.TransactionResponse>(
    [[firstResponse.hash, firstResponse]]
  );
  const knownHashes: string[] = [firstResponse.hash];
  let activeTx = initialTx;
  let activeResponse = firstResponse;
  let activeRawTx = extractRawTransaction(firstResponse);
  let replacementCount = 0;
  let rebroadcastRawUnavailableLogged = false;

  log(
    `Submitted tx: address=${signerAddress} chain=${chainId} nonce=${nonce} hash=${firstResponse.hash}`
  );

  if (!provider || typeof provider.getTransactionReceipt !== "function") {
    await firstResponse.wait();
    return firstResponse;
  }
  const txProvider = provider;

  const startedAt = Date.now();
  let nextRebroadcastAt =
    config.rebroadcastIntervalS > 0
      ? startedAt + secondsToMs(config.rebroadcastIntervalS)
      : Number.POSITIVE_INFINITY;
  let nextReplaceAt =
    config.replaceIntervalS > 0
      ? startedAt + secondsToMs(config.replaceIntervalS)
      : Number.POSITIVE_INFINITY;

  // Single in-flight lifecycle loop:
  // 1) check mined receipts across known hashes
  // 2) optional rebroadcast raw tx
  // 3) optional same-nonce replacement with bumped fee
  while (true) {
    const receipt = await findMinedReceipt(txProvider, knownHashes);
    if (receipt) {
      if (receipt.status === 0) {
        throw new Error(
          `Nonce-queued transaction reverted on-chain: hash=${receipt.transactionHash} nonce=${nonce}`
        );
      }
      return responsesByHash.get(receipt.transactionHash) ?? activeResponse;
    }

    const now = Date.now();
    if (
      config.txConfirmTimeoutS > 0 &&
      now - startedAt >= secondsToMs(config.txConfirmTimeoutS)
    ) {
      throw new Error(
        `Timed out waiting for nonce-queued tx confirmation after ${config.txConfirmTimeoutS}s: address=${signerAddress} chain=${chainId} nonce=${nonce} lastHash=${activeResponse.hash}`
      );
    }

    if (now >= nextRebroadcastAt) {
      nextRebroadcastAt = now + secondsToMs(config.rebroadcastIntervalS);

      if (activeRawTx && typeof txProvider.sendTransaction === "function") {
        try {
          // Re-check cap at rebroadcast time; tx may have been replaced with
          // a higher fee since the initial submission.
          enforceRebroadcastGasPriceCap({
            rawTransaction: activeRawTx,
            maxGasPriceWei,
            maxGasPriceEnvKey,
            signerAddress,
            chainId,
            nonce,
          });
          const rebroadcastResponse = await txProvider.sendTransaction(
            activeRawTx
          );
          if (!responsesByHash.has(rebroadcastResponse.hash)) {
            responsesByHash.set(rebroadcastResponse.hash, rebroadcastResponse);
            knownHashes.push(rebroadcastResponse.hash);
          }
          log(
            `Rebroadcasted raw tx: address=${signerAddress} chain=${chainId} nonce=${nonce} hash=${rebroadcastResponse.hash}`
          );
        } catch (err: any) {
          if (!isDuplicateBroadcastError(err)) throw err;
          log(
            `Rebroadcast ignored duplicate: address=${signerAddress} chain=${chainId} nonce=${nonce} hash=${activeResponse.hash}`
          );
        }
      } else if (!rebroadcastRawUnavailableLogged) {
        rebroadcastRawUnavailableLogged = true;
        log(
          `Rebroadcast skipped: raw transaction payload unavailable for hash=${activeResponse.hash} address=${signerAddress} chain=${chainId}`
        );
      }
    }

    if (
      now >= nextReplaceAt &&
      replacementCount < config.maxReplacements &&
      config.replaceIntervalS > 0
    ) {
      nextReplaceAt = now + secondsToMs(config.replaceIntervalS);
      activeTx = await buildReplacementTransaction(
        activeTx,
        txProvider,
        config.feeBumpPct
      );
      activeTx = await applyGasLimitBuffer({
        transaction: activeTx,
        provider: txProvider,
        gasLimitBufferPct: config.gasLimitBufferPct,
        signerAddress,
        chainId,
        nonce,
        stage: "replacement",
      });
      // Replacement txs are still fresh submissions. Enforce the same chain cap
      // after fee bumping so retries never exceed operator limits.
      await enforceSubmissionGasPriceCap({
        transaction: activeTx,
        provider: txProvider,
        maxGasPriceWei,
        maxGasPriceEnvKey,
        stage: "replacement",
        signerAddress,
        chainId,
        nonce,
      });

      try {
        const replacementResponse = await sendTransaction(activeTx);
        replacementCount++;
        activeResponse = replacementResponse;
        activeRawTx = extractRawTransaction(replacementResponse);
        if (!responsesByHash.has(replacementResponse.hash)) {
          responsesByHash.set(replacementResponse.hash, replacementResponse);
          knownHashes.push(replacementResponse.hash);
        }
        log(
          `Submitted replacement tx: address=${signerAddress} chain=${chainId} nonce=${nonce} hash=${replacementResponse.hash} replacements=${replacementCount}/${config.maxReplacements}`
        );
      } catch (err: any) {
        if (!isNonceMismatchError(err) && !isDuplicateBroadcastError(err)) {
          throw err;
        }
        log(
          `Replacement attempt not accepted yet: address=${signerAddress} chain=${chainId} nonce=${nonce} reason="${
            err?.message ?? String(err)
          }"`
        );
      }
    }

    await sleep(secondsToMs(config.receiptPollS));
  }
}

export function isNonceMismatchError(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("nonce too low") ||
    msg.includes("nonce has already been used") ||
    msg.includes("replacement transaction underpriced")
  );
}

export async function recoverNonceFromChain({
  pool,
  signerAddress,
  chainId,
  getOnChainNonce,
  client,
}: {
  pool: Pool;
  signerAddress: string;
  chainId: number;
  getOnChainNonce: () => Promise<number>;
  client?: PoolClient;
}) {
  const onChainNonce = await getOnChainNonce();
  const recoveryClient = client ?? (await pool.connect());
  const usingExternalClient = !!client;

  try {
    await recoveryClient.query(
      "UPDATE nonce_queue SET nonce = $1, updated_at = NOW() WHERE signer_address = $2 AND chain_id = $3",
      [onChainNonce, signerAddress, chainId]
    );
    log(
      `Recovered nonce from chain: address=${signerAddress} chain=${chainId} nonce=${onChainNonce}`
    );
  } finally {
    if (!usingExternalClient) recoveryClient.release();
  }
}
