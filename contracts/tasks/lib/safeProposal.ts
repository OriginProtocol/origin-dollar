import SafeApiKit from "@safe-global/api-kit";
import Safe, { adjustVInSignature } from "@safe-global/protocol-kit";
import {
  OperationType,
  SigningMethod,
  type MetaTransactionData,
  type SafeMultisigTransactionResponse,
  type SafeTransaction,
} from "@safe-global/types-kit";
import { Contract, ethers } from "ethers";
import { arrayify, getAddress } from "ethers/lib/utils";

import type { Logger } from "./action";

const SAFE_ABI = ["function nonce() external view returns (uint256)"];

export interface NonceState {
  nonce: number;
  onchainNonce: number;
  nextAvailableNonce: number;
  existing: SafeMultisigTransactionResponse[];
}

export interface SafeClients {
  apiKit: SafeApiKit;
  protocolKit: Safe;
}

function eip1193Provider(provider: ethers.providers.Provider) {
  return {
    request: async ({ method, params }: { method: string; params?: unknown }) =>
      (provider as ethers.providers.JsonRpcProvider).send(
        method,
        Array.isArray(params) ? params : []
      ),
  };
}

export async function createSafeClients({
  provider,
  safeAddress,
  chainId,
  apiKey,
}: {
  provider: ethers.providers.Provider;
  safeAddress: string;
  chainId: number;
  apiKey: string;
}): Promise<SafeClients> {
  const [protocolKit] = await Promise.all([
    Safe.init({
      provider: eip1193Provider(provider),
      safeAddress,
      isL1SafeSingleton: chainId === 1,
    }),
  ]);
  return {
    protocolKit,
    apiKit: new SafeApiKit({ chainId: BigInt(chainId), apiKey }),
  };
}

export async function resolveNonce({
  apiKit,
  provider,
  safeAddress,
  requestedNonce,
  log,
}: {
  apiKit: SafeApiKit;
  provider: ethers.providers.Provider;
  safeAddress: string;
  requestedNonce?: number;
  log: Logger;
}): Promise<NonceState> {
  const safe = new Contract(safeAddress, SAFE_ABI, provider);
  const [onchainNonceBn, nextAvailableRaw] = await Promise.all([
    safe.nonce(),
    apiKit.getNextNonce(safeAddress),
  ]);
  const onchainNonce = onchainNonceBn.toNumber();
  const nextAvailableNonce = Number(nextAvailableRaw);
  if (!Number.isSafeInteger(nextAvailableNonce)) {
    throw new Error(
      `Safe service returned invalid next nonce "${nextAvailableRaw}"`
    );
  }

  const nonce = requestedNonce ?? nextAvailableNonce;
  if (!Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error("Safe nonce must be a non-negative safe integer");
  }
  if (nonce < onchainNonce) {
    throw new Error(
      `Safe nonce ${nonce} has already been consumed; current onchain nonce is ${onchainNonce}`
    );
  }
  const response = await apiKit.getMultisigTransactions(safeAddress, {
    nonce: String(nonce),
    limit: 100,
  });
  const existing = response.results.filter(
    (transaction) => Number(transaction.nonce) === nonce
  );
  return validateNonceSelection({
    requestedNonce,
    onchainNonce,
    nextAvailableNonce,
    existing,
    log,
  });
}

export function validateNonceSelection({
  requestedNonce,
  onchainNonce,
  nextAvailableNonce,
  existing,
  log,
}: {
  requestedNonce?: number;
  onchainNonce: number;
  nextAvailableNonce: number;
  existing: SafeMultisigTransactionResponse[];
  log: Logger;
}): NonceState {
  const nonce = requestedNonce ?? nextAvailableNonce;
  if (!Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error("Safe nonce must be a non-negative safe integer");
  }
  if (nonce < onchainNonce) {
    throw new Error(
      `Safe nonce ${nonce} has already been consumed; current onchain nonce is ${onchainNonce}`
    );
  }
  const executed = existing.find((transaction) => transaction.isExecuted);
  if (executed) {
    throw new Error(
      `Safe nonce ${nonce} was already executed in ${
        executed.transactionHash ?? executed.safeTxHash
      }`
    );
  }
  if (requestedNonce !== undefined && nonce > nextAvailableNonce) {
    log.warn(
      `Explicit nonce ${nonce} creates a gap after next available nonce ${nextAvailableNonce}`
    );
  }
  for (const transaction of existing) {
    log.warn(
      `Unexecuted proposal already uses nonce ${nonce}: ${transaction.safeTxHash}`
    );
  }

  return { nonce, onchainNonce, nextAvailableNonce, existing };
}

export async function assertNonceStillAvailable({
  provider,
  safeAddress,
  nonce,
}: {
  provider: ethers.providers.Provider;
  safeAddress: string;
  nonce: number;
}) {
  const safe = new Contract(safeAddress, SAFE_ABI, provider);
  const current = await safe.nonce();
  if (current.gt(nonce)) {
    throw new Error(
      `Safe nonce ${nonce} became stale during validation; current onchain nonce is ${current.toString()}`
    );
  }
}

export async function createSafeTransaction({
  protocolKit,
  calls,
  nonce,
}: {
  protocolKit: Safe;
  calls: MetaTransactionData[];
  nonce: number;
}): Promise<SafeTransaction> {
  return protocolKit.createTransaction({
    transactions: calls,
    onlyCalls: true,
    options: { nonce },
  });
}

export function findIdenticalProposal(
  existing: SafeMultisigTransactionResponse[],
  transaction: SafeTransaction
) {
  return existing.find(
    (candidate) =>
      !candidate.isExecuted &&
      candidate.to.toLowerCase() === transaction.data.to.toLowerCase() &&
      candidate.value === transaction.data.value &&
      (candidate.data ?? "0x").toLowerCase() ===
        transaction.data.data.toLowerCase() &&
      candidate.operation === transaction.data.operation
  );
}

export async function assertRegisteredDelegate({
  apiKit,
  safeAddress,
  signerAddress,
}: {
  apiKit: SafeApiKit;
  safeAddress: string;
  signerAddress: string;
}) {
  const delegates = await apiKit.getSafeDelegates({
    safeAddress,
    delegateAddress: signerAddress,
    limit: 100,
  });
  const registered = delegates.results.some(
    (delegate) =>
      delegate.safe.toLowerCase() === safeAddress.toLowerCase() &&
      delegate.delegate.toLowerCase() === signerAddress.toLowerCase() &&
      (!delegate.expiryDate ||
        new Date(delegate.expiryDate).getTime() > Date.now())
  );
  if (!registered) {
    throw new Error(
      `Talos signer ${signerAddress} is not registered as a Safe Transaction Service delegate for ${safeAddress}`
    );
  }
}

export async function estimateSafeTransaction({
  apiKit,
  safeAddress,
  transaction,
}: {
  apiKit: SafeApiKit;
  safeAddress: string;
  transaction: SafeTransaction;
}) {
  return apiKit.estimateSafeTransaction(safeAddress, {
    to: transaction.data.to,
    value: transaction.data.value,
    data: transaction.data.data,
    operation: transaction.data.operation,
  });
}

export async function proposeSafeTransaction({
  apiKit,
  protocolKit,
  safeAddress,
  signer,
  transaction,
}: {
  apiKit: SafeApiKit;
  protocolKit: Safe;
  safeAddress: string;
  signer: ethers.Signer;
  transaction: SafeTransaction;
}) {
  const signerAddress = getAddress(await signer.getAddress());
  const safeTxHash = await protocolKit.getTransactionHash(transaction);
  const senderSignature = await signSafeTransactionHash(
    signer,
    safeTxHash,
    signerAddress
  );

  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: transaction.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature,
    origin: "Talos: proposeVaultStrategyMoves",
  });
  return safeTxHash;
}

export async function signSafeTransactionHash(
  signer: ethers.Signer,
  safeTxHash: string,
  signerAddress?: string
) {
  const address = getAddress(signerAddress ?? (await signer.getAddress()));
  const rawSignature = await signer.signMessage(arrayify(safeTxHash));
  return adjustVInSignature(
    SigningMethod.ETH_SIGN,
    rawSignature,
    safeTxHash,
    address
  );
}

export function toMetaTransactions(
  calls: { to: string; value: string; data: string }[]
): MetaTransactionData[] {
  return calls.map((call) => ({
    to: call.to,
    value: call.value,
    data: call.data,
    operation: OperationType.Call,
  }));
}

export function safeTransactionUrl(
  chainId: number,
  safeAddress: string,
  safeTxHash: string
) {
  const prefix = chainId === 1 ? "eth" : chainId === 8453 ? "base" : chainId;
  return `https://app.safe.global/transactions/tx?safe=${prefix}:${safeAddress}&id=multisig_${safeAddress}_${safeTxHash}`;
}
