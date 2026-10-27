import { BigNumber, ethers } from "ethers";
import { rpcUrlFor } from "./network";

/**
 * Shared logic for the OETHb V3 cross-chain wOETH strategy actions
 * (`oethbV3BalanceReport`, `oethbV3SettleWithdrawal`, `oethbV3RetryDeposit`).
 * Decisions are pure functions so they can be unit tested with fakes; see
 * contracts/strategies/crosschainV3/RUNBOOK.md for the operational picture.
 */

export const REMOTE_ABI = [
  "function operator() view returns (address)",
  "function outboundAdapter() view returns (address)",
  "function lastYieldNonce() view returns (uint64)",
  "function isYieldOpInFlight() view returns (bool)",
  "function checkBalance(address) view returns (uint256)",
  "function outstandingRequestId() view returns (uint256)",
  "function outstandingRequestAmount() view returns (uint256)",
  "function sendBalanceReport() payable",
  "function retryDeposit()",
];

export const MASTER_ABI = [
  "function operator() view returns (address)",
  "function outboundAdapter() view returns (address)",
  "function lastYieldNonce() view returns (uint64)",
  "function isYieldOpInFlight() view returns (bool)",
  "function remoteStrategyBalance() view returns (uint256)",
  "function pendingWithdrawalAmount() view returns (uint256)",
  "function lastBalanceCheckTimestamp() view returns (uint256)",
  "function triggerClaim() payable",
];

export const ADAPTER_ABI = [
  "function quoteFee(address token, uint256 amount, bytes payload) view returns (uint256 fee, address feeToken, bool requiresExternalPayment)",
  "function hasPendingMessage(address target) view returns (bool)",
  "function processStoredMessage(address target)",
];

export const OETH_VAULT_ABI = [
  "function withdrawalClaimDelay() view returns (uint256)",
  "function withdrawalRequests(uint256) view returns (tuple(address withdrawer, bool claimed, uint40 timestamp, uint128 amount, uint128 queued))",
  "function claimWithdrawal(uint256 requestId) returns (uint256)",
];

export const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

/** Strategy message types (`CrossChainV3Helper`). */
export const MSG = {
  DEPOSIT: 1,
  DEPOSIT_ACK: 2,
  WITHDRAW_REQUEST: 3,
  WITHDRAW_REQUEST_ACK: 4,
  WITHDRAW_CLAIM: 5,
  WITHDRAW_CLAIM_ACK: 6,
  BALANCE_REPORT: 7,
} as const;

/** Remote's `outstandingRequestId` when no OETH queue request is open. */
export const REQUEST_ID_EMPTY = ethers.constants.MaxUint256;

/** Top up Remote's pool when it covers fewer sends than this: it also pays
 *  for every ack, so it must outlast a burst of operations between reports. */
export const MIN_POOL_SENDS = 10;
/** Refill to this many sends, so a top-up happens about every 30 reports. */
export const TARGET_POOL_SENDS = 40;
/** Bounds one top-up even if a fee quote comes back absurd. */
export const MAX_TOPUP_WEI = ethers.utils.parseEther("0.02");

export const ccipLink = (txHash: string) =>
  `https://ccip.chain.link/tx/${txHash}`;

/** Read-only provider for the peer chain. `rpcUrlFor` resolves the per-chain
 *  fork URL when FORK=true, so this works against a two-chain anvil stack. */
export function peerProvider(chainId: number) {
  return new ethers.providers.JsonRpcProvider(rpcUrlFor(chainId).url, chainId);
}

/** `abi.encode(uint32 msgType, uint64 nonce, bytes body)`, the strategy envelope. */
export function encodePayload(
  msgType: number,
  nonce: ethers.BigNumberish,
  body = "0x"
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ["uint32", "uint64", "bytes"],
    [msgType, nonce, body]
  );
}

/** The adapter prices the lane of `msg.sender`, so quote as the strategy;
 *  without `from` the quote is for an unconfigured lane. */
export async function quoteFee(
  adapter: ethers.Contract,
  strategy: string,
  payload: string
): Promise<BigNumber> {
  const [fee] = await adapter.callStatic.quoteFee(
    ethers.constants.AddressZero,
    0,
    payload,
    { from: strategy }
  );
  return fee;
}

export function revertReason(err: unknown): string {
  const e = err as {
    reason?: string;
    error?: { message?: string };
    message?: string;
  };
  return e.reason || e.error?.message || e.message || String(err);
}

export type ReportDecision =
  | { action: "send" }
  | { action: "skip"; reason: string }
  | { action: "error"; reason: string };

export function reportDecision({
  masterInFlight,
  masterNonce,
  remoteNonce,
  remoteBalance,
  masterRemoteBalance,
}: {
  masterInFlight: boolean;
  masterNonce: BigNumber;
  remoteNonce: BigNumber;
  remoteBalance: BigNumber;
  masterRemoteBalance: BigNumber;
}): ReportDecision {
  // Master drops a report while an operation is in flight, so the fee would
  // be wasted; the operation's own ack refreshes the balance anyway.
  if (masterInFlight) {
    return { action: "skip", reason: "Master has an operation in flight" };
  }
  // Remote adopts Master's nonce on every inbound message, so with Master idle
  // they must agree. A report on a stale nonce would be dropped too.
  if (!masterNonce.eq(remoteNonce)) {
    return {
      action: "error",
      reason: `Nonce mismatch with Master idle: Remote ${remoteNonce}, Master ${masterNonce}`,
    };
  }
  if (remoteBalance.isZero() && masterRemoteBalance.isZero()) {
    return { action: "skip", reason: "Remote and Master both report 0" };
  }
  return { action: "send" };
}

/** ETH to send with `sendBalanceReport` so Remote's pool keeps paying for
 *  reports and acks. */
export function reportTopUp(pool: BigNumber, fee: BigNumber): BigNumber {
  if (pool.gte(fee.mul(MIN_POOL_SENDS))) return BigNumber.from(0);
  const want = fee.mul(TARGET_POOL_SENDS).sub(pool);
  return want.gt(MAX_TOPUP_WEI) ? MAX_TOPUP_WEI : want;
}

/** ETH to send with `triggerClaim`: Master's pool is sized for deposits by
 *  hand, so only cover this claim (with headroom) when it falls short. */
export function claimTopUp(pool: BigNumber, fee: BigNumber): BigNumber {
  return pool.lt(fee) ? fee.mul(2).sub(pool) : BigNumber.from(0);
}

export type ClaimReadiness =
  | { ready: true; reason: string }
  | { ready: false; reason: string };

/**
 * Whether Remote can claim its OETH queue request now, so leg 2 is not NACKed
 * (a NACK costs two CCIP fees and another round trip).
 */
export async function claimReadiness({
  requestId,
  requestAmount,
  now,
  readRequest,
  readDelay,
  simulateClaim,
}: {
  requestId: BigNumber;
  requestAmount: BigNumber;
  now: number;
  readRequest: (id: BigNumber) => Promise<{ timestamp: number | BigNumber }>;
  readDelay: () => Promise<BigNumber>;
  simulateClaim: (id: BigNumber) => Promise<unknown>;
}): Promise<ClaimReadiness> {
  if (requestId.eq(REQUEST_ID_EMPTY)) {
    // Someone already called claimRemoteWithdrawal: the WETH sits on Remote.
    if (requestAmount.gt(0)) {
      return { ready: true, reason: "queue claim already landed on Remote" };
    }
    throw new Error(
      "Master has a pending withdrawal but Remote has no queue request or claimed amount"
    );
  }

  const [request, delay] = await Promise.all([
    readRequest(requestId),
    readDelay(),
  ]);
  const claimableAt = Number(request.timestamp) + delay.toNumber();
  if (now < claimableAt) {
    return {
      ready: false,
      reason: `request ${requestId} claimable in ${claimableAt - now}s`,
    };
  }

  // Queue liquidity can only be confirmed by simulating the claim as Remote.
  try {
    await simulateClaim(requestId);
  } catch (err) {
    return {
      ready: false,
      reason: `request ${requestId} not claimable yet (${revertReason(err)})`,
    };
  }
  return { ready: true, reason: `request ${requestId} is claimable` };
}

/** Idle value `retryDeposit` would put back to work. Mirrors
 *  `RemoteWOTokenStrategy.retryDeposit`: WETH from a claimed but unshipped
 *  withdrawal belongs to leg 2 and is reserved. */
export function retryableIdle({
  wethBalance,
  oethBalance,
  requestId,
  requestAmount,
}: {
  wethBalance: BigNumber;
  oethBalance: BigNumber;
  requestId: BigNumber;
  requestAmount: BigNumber;
}): { idleWeth: BigNumber; idleOeth: BigNumber } {
  const reserved = requestId.eq(REQUEST_ID_EMPTY)
    ? requestAmount
    : BigNumber.from(0);
  const idleWeth = wethBalance.gt(reserved)
    ? wethBalance.sub(reserved)
    : BigNumber.from(0);
  return { idleWeth, idleOeth: oethBalance };
}
