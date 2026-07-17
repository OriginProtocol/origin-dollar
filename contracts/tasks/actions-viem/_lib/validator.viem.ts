// viem-native port of the CompoundingStaking validator entry functions that the
// Talos validator actions call. Faithful port of tasks/validatorCompound.js.
//
// The 7 entry functions the actions call, ported here:
//   - snapBalances
//   - removeValidator
//   - stakeValidator            (exported also as `stakeValidators` alias — see note)
//   - registerValidator         (exported also as `registerValidators` alias — see note)
//   - autoValidatorDeposits
//   - autoValidatorWithdrawals
//
// NOTE ON PLURAL NAMES: the migration brief lists `stakeValidators` /
// `registerValidators`. In this codebase those plural names only exist in the
// bundled Defender actions (scripts/defender-actions/dist/{stakeValidators,
// registerValidators}), which are the OLD NativeStaking (non-compounding) S3 +
// Defender-KVStore state-machine flow — explicitly out of scope (DROP Defender
// bits). The current compounding-strategy entry points the live Talos actions
// call are the singular `stakeValidator` / `registerValidator`. They are exported
// here under both names so callers using either spelling resolve to the correct
// compounding implementation.
//
// Rules honored (per migration guide):
//   hre/getSigner            -> ctx.account / ctx.walletClient
//   resolveContract(name)    -> ctx.resolveContract({ deploymentName, abiFrom })
//   new ethers.Contract(...) -> ctx.resolveContract({ address, abiFrom: inline })
//   write + logTxDetails     -> ctx.writeContract(...)
//   { gasLimit } -> { gas }; { value } -> { value }
//   view calls   -> contract.read.fn([...])
//   BigNumber    -> bigint
//   parseUnits/formatUnits from "viem"; solidityPack -> encodePacked
//   PRESERVE BLS verify, SSV keyshare gen, P2P provider fetches, all logs/dryrun/ordering
//
// Cryptographic paths (deposit-data-root, pubkey hash, BLS deposit-signature
// verification) are kept byte-faithful: calcDepositRoot/hashPubKey are the proven
// ports in ./depositData.viem; verifyDepositSignatureAndMessageRoot is ported
// below with its @chainsafe/bls + @lodestar calls intact.

import {
  encodePacked,
  formatUnits,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import type { ActionContext } from "../../lib/viemAction";
import { calcDepositRoot, hashPubKey } from "./depositData.viem";
import { getBeaconBlock, getSlot } from "./beaconState.viem";
import { toHex } from "./beaconBytes";

const log = require("../../../utils/logger")("task:validator:compounding");

// Legacy CommonJS helpers that are not ethers-coupled and remain the source of
// truth. These perform SSV keyshare/cluster reads (utils/ssv.js) — kept intact
// per the guide.
const { getClusterInfo, splitOperatorIds } = require("../../../utils/ssv");
const addresses = require("../../../utils/addresses");

// The P2P provider helper (utils/p2pValidatorCompound.js) is required lazily
// inside the `uuid` branches only. It pulls in `node-fetch` at its module top,
// which is not always installed for tsx-only loads; deferring the require keeps
// this module importable while preserving the P2P fetches byte-for-byte when the
// uuid path actually runs (under the same node_modules the live actions use).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadP2p = (): any => require("../../../utils/p2pValidatorCompound");

// -------------------------------------------------------------------------
// Validator / deposit state enums (from CompoundingValidatorStorage.sol,
// mirrored in validatorCompound.js).
// -------------------------------------------------------------------------
const VALIDATOR_STATE_NON_REGISTERED = 0;
const VALIDATOR_STATE_REGISTERED = 1;
const VALIDATOR_STATE_ACTIVE = 4;

// -------------------------------------------------------------------------
// Inline ABIs. Selectors verified byte-for-byte against
// deployments/mainnet/CompoundingStakingSSVStrategy.json (see selectorsVerified
// in the migration report). Tuple field names are copied from the on-chain ABI
// so viem encodes the components positionally-correct.
// -------------------------------------------------------------------------

const clusterComponents = [
  { name: "validatorCount", type: "uint32" },
  { name: "networkFeeIndex", type: "uint64" },
  { name: "index", type: "uint64" },
  { name: "active", type: "bool" },
  { name: "balance", type: "uint256" },
] as const;

// Full compounding-strategy surface used by these entry functions.
const strategyAbi = [
  {
    type: "function",
    name: "snapBalances",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "stakeEth",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "validatorStakeData",
        type: "tuple",
        components: [
          { name: "pubkey", type: "bytes" },
          { name: "signature", type: "bytes" },
          { name: "depositDataRoot", type: "bytes32" },
        ],
      },
      { name: "depositAmountGwei", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "registerSsvValidator",
    stateMutability: "payable",
    inputs: [
      { name: "publicKey", type: "bytes" },
      { name: "operatorIds", type: "uint64[]" },
      { name: "sharesData", type: "bytes" },
      { name: "cluster", type: "tuple", components: clusterComponents },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removeSsvValidator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "publicKey", type: "bytes" },
      { name: "operatorIds", type: "uint64[]" },
      { name: "cluster", type: "tuple", components: clusterComponents },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "validatorWithdrawal",
    stateMutability: "payable",
    inputs: [
      { name: "pubkey", type: "bytes" },
      { name: "amountGwei", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setRegistrator",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  // views
  {
    type: "function",
    name: "initialDepositAmountWei",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "validator",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "state", type: "uint8" },
      { name: "index", type: "uint40" },
    ],
  },
  {
    type: "function",
    name: "verifiedValidatorsLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "verifiedValidators",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "depositListLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "depositList",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "pubKeyHash", type: "bytes32" },
      { name: "amountGwei", type: "uint64" },
      { name: "slot", type: "uint64" },
      { name: "depositIndex", type: "uint32" },
      { name: "status", type: "uint8" },
    ],
  },
] as const satisfies Abi;

// ConsolidationController variants (extra `strategy` address arg on the SSV /
// stake paths). snapBalances / validatorWithdrawal / stakeEth((...),uint64)
// share selectors with the strategy, so only the SSV-remove overload differs.
const consolControllerAbi = [
  {
    type: "function",
    name: "snapBalances",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "removeSsvValidator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategy", type: "address" },
      { name: "publicKey", type: "bytes" },
      { name: "operatorIds", type: "uint64[]" },
      { name: "cluster", type: "tuple", components: clusterComponents },
    ],
    outputs: [],
  },
  // stakeEth((bytes,bytes,bytes32),uint64) — identical selector 0x4583ef10 to the
  // strategy's; validatorCompound.js uses this signature for the consol path.
  {
    type: "function",
    name: "stakeEth",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "validatorStakeData",
        type: "tuple",
        components: [
          { name: "pubkey", type: "bytes" },
          { name: "signature", type: "bytes" },
          { name: "depositDataRoot", type: "bytes32" },
        ],
      },
      { name: "depositAmountGwei", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "validatorWithdrawal",
    stateMutability: "payable",
    inputs: [
      { name: "pubkey", type: "bytes" },
      { name: "amountGwei", type: "uint64" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

const ierc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

// -------------------------------------------------------------------------
// Shared byte / constant helpers (kept identical to the ethers originals).
// -------------------------------------------------------------------------

// Empty 96-byte BLS signature. Signatures do not matter after the first deposit
// to a validator (identical constant to validatorCompound.js).
const EMPTY_SIGNATURE =
  "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" as Hex;

// The non-zero "empty" signature used by stakeValidator for post-first deposits
// (ends in ...0001). Byte-identical to validatorCompound.js.
const POST_FIRST_DEPOSIT_SIGNATURE =
  "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001" as Hex;

// Faithful port of calcWithdrawalCredential in tasks/beaconTesting.js
// (solidityPack -> encodePacked).
const calcWithdrawalCredential = (type: string, owner: string): Hex => {
  const withdrawalCredential = encodePacked(
    ["bytes1", "bytes11", "address"],
    [
      type as Hex,
      "0x0000000000000000000000" as Hex,
      owner as Address,
    ]
  );
  log(`Withdrawal Credentials: ${withdrawalCredential}`);
  return withdrawalCredential;
};

// -------------------------------------------------------------------------
// BLS deposit-signature + message-root verification.
//
// Faithful port of verifyDepositSignatureAndMessageRoot in utils/beacon.js.
// The @chainsafe/bls + @lodestar cryptographic calls are unchanged; only the
// ethers `parseUnits` is swapped for viem's `parseUnits` (same Gwei value).
// -------------------------------------------------------------------------
const verifyDepositSignatureAndMessageRoot = async ({
  pubkey,
  withdrawalCredentials,
  amount,
  signature,
  depositMessageRoot,
  forkVersion,
}: {
  pubkey: string;
  withdrawalCredentials: string;
  amount: string | number;
  signature: string;
  depositMessageRoot: string;
  forkVersion: string;
}): Promise<void> => {
  // ESM-only packages — dynamic import, identical to the original.
  const bls = await import("@chainsafe/bls");
  const { ssz } = await import("@lodestar/types/phase0");
  const { computeDomain, computeSigningRoot } = await import(
    "@lodestar/state-transition"
  );
  const { DOMAIN_DEPOSIT } = await import("@lodestar/params");
  const { fromHex } = await import("@lodestar/utils");

  log("Validating BLS deposit message signature");
  log(`pubkey: ${pubkey}`);
  log(`withdrawalCredentials: ${withdrawalCredentials}`);
  log(`amount: ${amount}`);
  log(`signature: ${signature}`);
  log(`depositMessageRoot: ${depositMessageRoot}`);
  log(`forkVersion: ${forkVersion}`);

  const amountGwei = parseUnits(amount.toString(), 9);
  depositMessageRoot = depositMessageRoot.startsWith("0x")
    ? depositMessageRoot.substring(2)
    : depositMessageRoot;

  const depositMessage = {
    pubkey: fromHex(pubkey),
    withdrawalCredentials: fromHex(withdrawalCredentials),
    amount: amountGwei.toString(),
  };

  const domain = computeDomain(
    DOMAIN_DEPOSIT,
    fromHex(forkVersion),
    new Uint8Array(32)
  );

  const signingRoot = computeSigningRoot(
    ssz.DepositMessage,
    depositMessage as never,
    domain
  );

  if (
    !bls.default.verify(depositMessage.pubkey, signingRoot, fromHex(signature))
  ) {
    throw Error(`BLS signature is invalid`);
  }

  log(`BLS signature valid`);

  const computedMessageRoot = ssz.DepositMessage.hashTreeRoot(
    depositMessage as never
  );
  const computedMessageRootString =
    Buffer.from(computedMessageRoot).toString("hex");
  if (depositMessageRoot != computedMessageRootString) {
    throw Error(
      `Deposit message root miss-match. Computed value: ${computedMessageRootString} vs supplied value: ${depositMessageRoot}`
    );
  }
  log(
    `Deposit message root matches the computed message root: ${depositMessageRoot}`
  );
};

// -------------------------------------------------------------------------
// Contract resolution + cluster snapshot / validator / deposit list reads.
// -------------------------------------------------------------------------

interface ResolveShim {
  read: Record<string, (args?: unknown[]) => Promise<unknown>>;
  address: Address;
  abi: Abi;
}

/**
 * Resolve the compounding staking strategy contract (SSV or non-SSV) plus the
 * validator state that represents a "creating deposit". Faithful port of
 * resolveCompoundingStakingContract in validatorCompound.js — the SSV strategy
 * treats a REGISTERED validator as the first-deposit state, the non-SSV one
 * treats NON_REGISTERED.
 */
function resolveCompoundingStakingContract(
  ctx: ActionContext,
  ssv = false
): { creatingDepositState: number; strategy: ResolveShim } {
  if (ssv) {
    return {
      creatingDepositState: VALIDATOR_STATE_REGISTERED,
      strategy: ctx.resolveContract({
        deploymentName: "CompoundingStakingSSVStrategyProxy",
        abiFrom: { kind: "inline", abi: strategyAbi },
      }) as unknown as ResolveShim,
    };
  }
  return {
    creatingDepositState: VALIDATOR_STATE_NON_REGISTERED,
    strategy: ctx.resolveContract({
      deploymentName: "CompoundingStakingStrategyProxy",
      abiFrom: { kind: "inline", abi: strategyAbi },
    }) as unknown as ResolveShim,
  };
}

interface VerifiedValidator {
  pubKeyHash: Hex;
  index: bigint;
  state: number;
}

// Faithful port of getVerifiedValidators (validatorCompound.js). viem does not
// support blockTag on getContract reads the same way, so "latest" is implicit.
async function getVerifiedValidators(
  strategy: ResolveShim
): Promise<VerifiedValidator[]> {
  const validatorCount = (await strategy.read.verifiedValidatorsLength(
    []
  )) as bigint;
  const validators: VerifiedValidator[] = [];
  for (let i = 0n; i < validatorCount; i++) {
    const pubKeyHash = (await strategy.read.verifiedValidators([i])) as Hex;
    const validator = (await strategy.read.validator([pubKeyHash])) as {
      state: number;
      index: bigint;
    };
    validators.push({
      pubKeyHash,
      index: validator.index,
      state: validator.state,
    });
  }
  return validators;
}

interface PendingDeposit {
  pendingDepositRoot: Hex;
  pubKeyHash: Hex;
  amountGwei: bigint;
  slot: bigint;
}

// Faithful port of getPendingDeposits (validatorCompound.js).
async function getPendingDeposits(
  strategy: ResolveShim
): Promise<PendingDeposit[]> {
  const depositCount = (await strategy.read.depositListLength([])) as bigint;
  const deposits: PendingDeposit[] = [];
  for (let i = 0n; i < depositCount; i++) {
    const pendingDepositRoot = (await strategy.read.depositList([i])) as Hex;
    const deposit = (await strategy.read.deposits([pendingDepositRoot])) as {
      pubKeyHash: Hex;
      amountGwei: bigint;
      slot: bigint;
    };
    deposits.push({
      pendingDepositRoot,
      pubKeyHash: deposit.pubKeyHash,
      amountGwei: deposit.amountGwei,
      slot: deposit.slot,
    });
  }
  return deposits;
}

// -------------------------------------------------------------------------
// Vault helper ports (from utils/vault.js). BigNumber -> bigint.
// -------------------------------------------------------------------------

interface VaultShim {
  read: {
    totalValue: (args?: unknown[]) => Promise<bigint>;
    withdrawalQueueMetadata: (
      args?: unknown[]
    ) => Promise<{ queued: bigint; claimed: bigint }>;
  };
  address: Address;
}

interface Erc20Shim {
  read: { balanceOf: (args: [Address]) => Promise<bigint> };
  address: Address;
}

// Faithful port of calcAvailableInVault (utils/vault.js).
async function calcAvailableInVault(
  weth: Erc20Shim,
  vault: VaultShim
): Promise<bigint> {
  const wethInVault = await weth.read.balanceOf([vault.address]);
  log(`WETH balance in vault ${formatUnits(wethInVault, 18)}`);

  const vaultWithdrawals = await vault.read.withdrawalQueueMetadata();
  const availableInVault =
    wethInVault - vaultWithdrawals.queued + vaultWithdrawals.claimed;
  log(`WETH available in vault ${formatUnits(availableInVault, 18)}`);
  return availableInVault;
}

// Faithful port of calcTargetBuffer (utils/vault.js).
async function calcTargetBuffer(
  vault: VaultShim,
  bufferBps: bigint
): Promise<bigint> {
  const totalAssets = await vault.read.totalValue();
  const targetBuffer = (totalAssets * bufferBps) / 10000n;
  log(
    `Buffer amount ${formatUnits(targetBuffer, 18)} (${bufferBps} bps of ${formatUnits(
      totalAssets,
      18
    )})`
  );
  return targetBuffer;
}

// Faithful port of withdrawFromStrategyIfNeeded (utils/vault.js). The ETH balance
// is read via publicClient.getBalance; the WETH balance via the ERC20 read.
async function withdrawFromStrategyIfNeeded({
  ctx,
  weth,
  strategy,
  vault,
  availableInVault,
  buffer,
  minStrategyWithdrawAmount,
  dryrun,
}: {
  ctx: ActionContext;
  weth: Erc20Shim;
  strategy: ResolveShim;
  vault: VaultShim;
  availableInVault: bigint;
  buffer: bigint;
  minStrategyWithdrawAmount: bigint;
  dryrun: boolean;
}): Promise<{ availableInStrategy: bigint; withdrawAmount: bigint }> {
  const wethInStrategy = await weth.read.balanceOf([strategy.address]);
  const ethInStrategy = await ctx.publicClient.getBalance({
    address: strategy.address,
  });
  log(`WETH available in strategy ${formatUnits(wethInStrategy, 18)}`);
  log(`ETH available in strategy ${formatUnits(ethInStrategy, 18)}`);

  const availableInStrategy = wethInStrategy + ethInStrategy;
  log(
    `${formatUnits(wethInStrategy, 18)} WETH and ${formatUnits(
      ethInStrategy,
      18
    )} ETH in strategy = ${formatUnits(
      availableInStrategy,
      18
    )} available in strategy`
  );
  const vaultShortfall = buffer - availableInVault;
  log(`Vault shortfall to target buffer ${formatUnits(vaultShortfall, 18)}`);

  const withdrawAmount =
    vaultShortfall < availableInStrategy ? vaultShortfall : availableInStrategy;
  if (withdrawAmount > minStrategyWithdrawAmount) {
    log(`Withdrawing ${formatUnits(withdrawAmount, 18)} ETH/WETH from the strategy`);
    if (!dryrun) {
      await ctx.writeContract(
        { address: strategy.address, abi: strategy.abi },
        "withdraw",
        [vault.address, weth.address, withdrawAmount],
        "withdrawFromStrategy"
      );
    }
  } else {
    log(`No need to withdraw from the strategy`);
  }

  return { availableInStrategy, withdrawAmount };
}

// Faithful port of totalPartialWithdrawals (utils/vault.js). Sums pending partial
// withdrawals for the given validator indexes and returns an 18-decimal amount.
async function totalPartialWithdrawals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stateView: any,
  validatorIndexes: number[],
  display = false
): Promise<bigint> {
  // eslint-disable-next-line no-console
  const output = display ? console.log : log;

  output(
    `\nPending partial withdrawals for validators: ${validatorIndexes.join(", ")}`
  );

  let totalGwei = 0n;
  let count = 0;
  for (let i = 0; i < stateView.pendingPartialWithdrawals.length; i++) {
    const withdrawal = stateView.pendingPartialWithdrawals.get(i);
    if (validatorIndexes.includes(withdrawal.validatorIndex)) {
      output(
        `  ${formatUnits(BigInt(withdrawal.amount), 9)} ETH from validator index ${
          withdrawal.validatorIndex
        }, withdrawable epoch ${withdrawal.withdrawableEpoch}`
      );
      totalGwei = totalGwei + BigInt(withdrawal.amount);
      count++;
    }
  }
  output(
    `${count} of ${
      stateView.pendingPartialWithdrawals.length
    } pending partial withdrawals from beacon chain totalling ${formatUnits(
      totalGwei,
      9
    )} ETH`
  );

  // Scale up to 18 decimals (parseUnits(totalGwei, 9)).
  return parseUnits(totalGwei.toString(), 9);
}

// =========================================================================
// ENTRY FUNCTIONS
// =========================================================================

/**
 * snapBalances — takes a balance snapshot on the strategy (or via the
 * ConsolidationController). Faithful port; the BalancesSnapped event is decoded
 * from the receipt against the strategy address.
 */
export async function snapBalances(
  ctx: ActionContext,
  args: { consol?: boolean; ssv?: boolean } = {}
): Promise<void> {
  const { consol = false, ssv = false } = args;

  const { strategy } = resolveCompoundingStakingContract(ctx, ssv);
  const target: { address: Address; abi: Abi } = consol
    ? ctx.resolveContract({
        deploymentName: "ConsolidationController",
        abiFrom: { kind: "inline", abi: consolControllerAbi },
      })
    : { address: strategy.address, abi: strategy.abi };

  log(`About to snap balances on ${target.address}`);
  const { receipt } = await ctx.writeContract(
    target,
    "snapBalances",
    [],
    "snapBalances"
  );

  // Decode the BalancesSnapped event from the strategy. When called via the
  // ConsolidationController the event is still emitted by the target strategy.
  const { decodeEventLog } = await import("viem");
  const balancesSnappedAbi = [
    {
      type: "event",
      name: "BalancesSnapped",
      inputs: [
        { name: "blockRoot", type: "bytes32", indexed: true },
        { name: "ethBalance", type: "uint256", indexed: false },
      ],
    },
  ] as const;

  const rawLog = receipt?.logs.find(
    (l) => l.address.toLowerCase() === strategy.address.toLowerCase()
  );
  if (!rawLog) {
    throw new Error("BalancesSnapped event not found in transaction receipt");
  }
  const parsed = decodeEventLog({
    abi: balancesSnappedAbi,
    data: rawLog.data,
    topics: rawLog.topics,
  });
  // eslint-disable-next-line no-console
  console.log(
    `Balances snapped successfully. Beacon block root ${
      parsed.args.blockRoot
    }, block ${receipt?.blockNumber}, ETH balance ${formatUnits(
      parsed.args.ethBalance,
      18
    )}`
  );
}

/**
 * registerValidator — registers an SSV compounding validator. If a `uuid` is
 * supplied the pubkey/shares/operators are fetched from P2P (state preserved),
 * otherwise they are passed directly. Cluster details come from the SSV API.
 *
 * Exported also as `registerValidators` (see NOTE at top of file).
 */
export async function registerValidator(
  ctx: ActionContext,
  args: {
    pubkey?: string;
    shares?: string;
    operatorids?: string;
    eth?: number | string;
    uuid?: string;
  }
): Promise<void> {
  let { pubkey, shares, operatorids } = args;
  const { eth = 0, uuid } = args;

  if (uuid) {
    const { getValidatorRequestStatus } = loadP2p();
    const {
      pubkey: _pubkey,
      shares: _shares,
      operatorids: _operatorids,
    } = await getValidatorRequestStatus({ uuid });
    pubkey = _pubkey;
    shares = _shares;
    // unsorted string of operators
    operatorids = _operatorids;
  }

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = splitOperatorIds(operatorids);

  const ethAmount = parseUnits(eth.toString(), 18);

  // registerSsvValidator only exists on the SSV strategy.
  const strategy = ctx.resolveContract({
    deploymentName: "CompoundingStakingSSVStrategyProxy",
    abiFrom: { kind: "inline", abi: strategyAbi },
  }) as unknown as ResolveShim;

  // Cluster details from the SSV API (chainId from the action context).
  const { cluster } = await getClusterInfo({
    chainId: ctx.chainId,
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`About to register compounding validator with pubkey ${pubkey}`);
  await ctx.writeContract(
    { address: strategy.address, abi: strategy.abi },
    "registerSsvValidator",
    [pubkey, operatorIds, shares, normalizeClusterTuple(cluster)],
    "registerValidator",
    { value: ethAmount }
  );
}

/**
 * stakeValidator — deposits ETH to a validator through the strategy (or the
 * ConsolidationController). If a `uuid` is supplied the deposit data is fetched
 * from P2P. The first deposit to a registered validator requires (and BLS-
 * verifies) a real signature; later deposits use a throwaway signature.
 *
 * Exported also as `stakeValidators` (see NOTE at top of file).
 */
export async function stakeValidator(
  ctx: ActionContext,
  args: {
    dryrun?: boolean;
    pubkey?: string;
    sig?: string;
    amount?: string | number;
    withdrawalCredentials?: string;
    depositMessageRoot?: string;
    forkVersion?: string;
    uuid?: string;
    consol?: boolean;
    ssv?: boolean;
  }
): Promise<void> {
  const { dryrun = false, uuid, consol = false, ssv = false } = args;
  let {
    pubkey,
    sig,
    amount,
    withdrawalCredentials,
    depositMessageRoot,
    forkVersion,
  } = args;

  if (uuid) {
    const { getValidatorRequestDepositData } = loadP2p();
    const {
      pubkey: _pubkey,
      sig: _sig,
      amount: _amount,
      depositMessageRoot: _depositMessageRoot,
      withdrawalCredentials: _withdrawalCredentials,
      forkVersion: _forkVersion,
    } = await getValidatorRequestDepositData({ uuid });
    pubkey = _pubkey;
    sig = _sig;
    amount = _amount;
    withdrawalCredentials = _withdrawalCredentials;
    depositMessageRoot = _depositMessageRoot;
    forkVersion = _forkVersion;
  }

  const { creatingDepositState, strategy: depositStrategy } =
    resolveCompoundingStakingContract(ctx, ssv);
  const target: { address: Address; abi: Abi } = consol
    ? ctx.resolveContract({
        deploymentName: "ConsolidationController",
        abiFrom: { kind: "inline", abi: consolControllerAbi },
      })
    : { address: depositStrategy.address, abi: depositStrategy.abi };

  if (!withdrawalCredentials) {
    withdrawalCredentials = calcWithdrawalCredential(
      "0x02",
      depositStrategy.address
    );
  }

  const amountWei = parseUnits(amount!.toString(), 18);
  const initialDepositAmountWei =
    (await depositStrategy.read.initialDepositAmountWei([])) as bigint;
  const validator = (await depositStrategy.read.validator([
    hashPubKey(pubkey!) as Hex,
  ])) as { state: number };
  const isCreatingDeposit = BigInt(validator.state) === BigInt(creatingDepositState);

  if (isCreatingDeposit) {
    if (!sig) {
      throw new Error(
        `The signature is required for the first deposit to a registered validator. Deposit amount: ${formatUnits(
          amountWei,
          18
        )} ETH, initial deposit cap: ${formatUnits(
          initialDepositAmountWei,
          18
        )} ETH`
      );
    }
    await verifyDepositSignatureAndMessageRoot({
      pubkey: pubkey!,
      withdrawalCredentials: withdrawalCredentials!,
      amount: amount!,
      signature: sig,
      depositMessageRoot: depositMessageRoot!,
      forkVersion: forkVersion!,
    });
  } else {
    // The signature doesn't matter after the first deposit.
    sig = POST_FIRST_DEPOSIT_SIGNATURE;
  }

  const depositDataRoot = await calcDepositRoot(
    depositStrategy.address,
    "0x02",
    pubkey!,
    sig!,
    amount!
  );

  const amountGwei = parseUnits(amount!.toString(), 9);

  if (dryrun) {
    // eslint-disable-next-line no-console
    console.log(`About to stake ${amount} ETH to validator with`);
    // eslint-disable-next-line no-console
    console.log(`  pubkey         : ${pubkey}`);
    // eslint-disable-next-line no-console
    console.log(`  signature      : ${sig}`);
    // eslint-disable-next-line no-console
    console.log(`  depositDataRoot: ${depositDataRoot}`);
    return;
  }

  log(
    `About to stake ${amount} ETH to validator with pubkey ${pubkey}, deposit root ${depositDataRoot} and signature ${sig} via ${
      consol ? "ConsolidationController" : "strategy"
    }`
  );
  const validatorStakeData = {
    pubkey: pubkey as Hex,
    signature: sig as Hex,
    depositDataRoot: depositDataRoot as Hex,
  };
  const { receipt } = await ctx.writeContract(
    target,
    "stakeEth",
    [validatorStakeData, amountGwei],
    "stakeETH"
  );

  // Decode the ETHStaked event from the deposit strategy for the pending root.
  const { decodeEventLog } = await import("viem");
  const ethStakedAbi = [
    {
      type: "event",
      name: "ETHStaked",
      inputs: [
        { name: "pubKeyHash", type: "bytes32", indexed: true },
        { name: "pendingDepositRoot", type: "bytes32", indexed: true },
        { name: "pubKey", type: "bytes", indexed: false },
        { name: "amountWei", type: "uint256", indexed: false },
      ],
    },
  ] as const;

  const rawLog = receipt?.logs.find(
    (l) => l.address.toLowerCase() === depositStrategy.address.toLowerCase()
  );
  if (!rawLog) {
    throw new Error("ETHStaked event not found in transaction receipt");
  }
  const event = decodeEventLog({
    abi: ethStakedAbi,
    data: rawLog.data,
    topics: rawLog.topics,
  });
  // eslint-disable-next-line no-console
  console.log(`Pending deposit root: ${event.args.pendingDepositRoot}`);
}

/**
 * autoValidatorDeposits — tops up the strategy's active validators from spare
 * WETH, respecting a vault buffer and per-validator max balance. Faithful port
 * of validatorCompound.js#autoValidatorDeposits.
 */
export async function autoValidatorDeposits(
  ctx: ActionContext,
  args: {
    slot?: number;
    maxBalance?: bigint;
    minDeposit?: bigint;
    buffer?: bigint;
    minStrategyWithdrawAmount?: bigint;
    dryrun?: boolean;
    ssv?: boolean;
  } = {}
): Promise<void> {
  const {
    slot,
    maxBalance: maxBalanceGwei = parseUnits("2030", 9),
    minDeposit: minDepositGwei = parseUnits("1.1", 9),
    buffer: bufferBps = 100n, // 1% buffer
    minStrategyWithdrawAmount = parseUnits("0.1", 18),
    dryrun = false,
    ssv = false,
  } = args;

  const networkName = ctx.networkName;
  const wethAddress = addresses[networkName].WETH as Address;
  const weth = ctx.resolveContract({
    address: wethAddress,
    abiFrom: { kind: "inline", abi: ierc20Abi },
  }) as unknown as Erc20Shim;
  const { strategy } = resolveCompoundingStakingContract(ctx, ssv);
  const vault = ctx.resolveContract({
    deploymentName: "OETHVaultProxy",
    abiFrom: { kind: "curated", file: "IVault" },
  }) as unknown as VaultShim;

  // 1. WETH available in the vault.
  const availableInVault = await calcAvailableInVault(weth, vault);

  // 2. Buffer amount = total assets * buffer bps.
  const buffer = await calcTargetBuffer(vault, bufferBps);

  // 3. Withdraw any WETH/ETH in the strategy if needed in the vault.
  await withdrawFromStrategyIfNeeded({
    ctx,
    weth,
    strategy,
    vault,
    availableInVault,
    buffer,
    minStrategyWithdrawAmount,
    dryrun,
  });

  // 4. How much can be deposited; stop if not enough.
  const wethInStrategy = await weth.read.balanceOf([strategy.address]);
  log(`WETH balance in strategy ${formatUnits(wethInStrategy, 18)}`);
  let remainingGwei = wethInStrategy / parseUnits("1", 9);

  if (remainingGwei < minDepositGwei) {
    log(
      `${formatUnits(
        remainingGwei,
        9
      )} WETH balance in strategy less than ${formatUnits(
        minDepositGwei,
        9
      )} ETH min deposit. Stopping`
    );
    return;
  }

  // 5. Active validators + pending deposits.
  const verifiedValidators = await getVerifiedValidators(strategy);
  const activeValidators = verifiedValidators.filter(
    (v) => BigInt(v.state) === BigInt(VALIDATOR_STATE_ACTIVE)
  );
  const pendingDeposits = await getPendingDeposits(strategy);

  // 6. Validator balances after pending deposits are processed.
  const { stateView } = await getBeaconBlock(slot, networkName);

  const validators: { index: number; pubKey: string; balanceGwei: bigint }[] =
    [];
  for (const validator of activeValidators) {
    const idx = Number(validator.index);
    let balanceGwei = BigInt(stateView.balances.get(idx));
    log(`  Validator ${idx} balance ${formatUnits(balanceGwei, 9)} ETH`);

    for (const deposit of pendingDeposits) {
      if (deposit.pubKeyHash === validator.pubKeyHash) {
        balanceGwei = balanceGwei + BigInt(deposit.amountGwei);
        log(
          `  Pending deposit of ${formatUnits(
            deposit.amountGwei,
            9
          )} ETH for validator ${idx}. New balance ${formatUnits(
            balanceGwei,
            9
          )} ETH`
        );
      }
    }

    const { pubkey } = stateView.validators.get(idx);
    validators.push({ index: idx, pubKey: toHex(pubkey), balanceGwei });
  }

  // 7. Filter + sort (largest to smallest balance).
  const filteredValidators = validators.filter(
    (v) => v.balanceGwei < maxBalanceGwei
  );
  const sortedValidators = filteredValidators.sort((a, b) =>
    a.balanceGwei > b.balanceGwei ? -1 : 1
  );

  // 8. Top up each validator toward max balance.
  for (const validator of sortedValidators) {
    const maxDepositAmount = maxBalanceGwei - validator.balanceGwei;
    const depositAmountGwei =
      remainingGwei < maxDepositAmount ? remainingGwei : maxDepositAmount;

    if (depositAmountGwei < minDepositGwei) continue;

    log(
      `About to top up validator ${validator.index} with ${formatUnits(
        depositAmountGwei,
        9
      )} WETH`
    );

    if (!dryrun) {
      const depositDataRoot = await calcDepositRoot(
        strategy.address,
        "0x02",
        validator.pubKey,
        // This sig doesn't matter after the first deposit.
        EMPTY_SIGNATURE,
        // ETH amount with no decimals.
        formatUnits(depositAmountGwei, 9)
      );

      await ctx.writeContract(
        { address: strategy.address, abi: strategy.abi },
        "stakeEth",
        [
          {
            pubkey: validator.pubKey as Hex,
            signature: EMPTY_SIGNATURE,
            depositDataRoot: depositDataRoot as Hex,
          },
          depositAmountGwei,
        ],
        "stakeEth"
      );
    }

    remainingGwei = remainingGwei - depositAmountGwei;

    if (remainingGwei < minDepositGwei) {
      log(
        `${formatUnits(
          remainingGwei,
          9
        )} WETH remaining less than ${formatUnits(
          minDepositGwei,
          9
        )} WETH min deposit. Stopping`
      );
      break;
    }
  }

  if (remainingGwei > 0n) {
    log(
      `${formatUnits(
        remainingGwei,
        9
      )} WETH remaining. Need more active validators before it can be deposited`
    );
  }
}

/**
 * autoValidatorWithdrawals — partially withdraws from validators to refill the
 * vault buffer. Faithful port of validatorCompound.js#autoValidatorWithdrawals.
 */
export async function autoValidatorWithdrawals(
  ctx: ActionContext,
  args: {
    slot?: number;
    buffer?: bigint;
    minValidatorWithdrawAmount?: bigint;
    minStrategyWithdrawAmount?: bigint;
    dryrun?: boolean;
    ssv?: boolean;
  } = {}
): Promise<void> {
  const {
    slot,
    buffer: bufferBps = 100n, // 1% buffer
    minValidatorWithdrawAmount = BigInt(10e18),
    minStrategyWithdrawAmount = parseUnits("0.1", 18),
    dryrun = false,
    ssv = false,
  } = args;

  const networkName = ctx.networkName;
  const wethAddress = addresses[networkName].WETH as Address;
  const weth = ctx.resolveContract({
    address: wethAddress,
    abiFrom: { kind: "inline", abi: ierc20Abi },
  }) as unknown as Erc20Shim;
  const vaultAddress = addresses[networkName].OETHVaultProxy as Address;
  const vault = ctx.resolveContract({
    address: vaultAddress,
    abiFrom: { kind: "curated", file: "IVault" },
  }) as unknown as VaultShim;
  const { strategy } = resolveCompoundingStakingContract(ctx, ssv);

  // 1. WETH available in the vault.
  const availableInVault = await calcAvailableInVault(weth, vault);

  // 2. Active validator indexes.
  const activeValidators = await getVerifiedValidators(strategy);
  const validatorIndexes = activeValidators.map((v) => Number(v.index));

  // 3. Pending validator partial withdrawals from the beacon chain.
  const { stateView } = await getBeaconBlock(slot, networkName);
  const totalPendingPartialWithdrawals = await totalPartialWithdrawals(
    stateView,
    validatorIndexes
  );

  // 4. Buffer amount.
  const buffer = await calcTargetBuffer(vault, bufferBps);

  // 5. Withdraw any WETH/ETH in the strategy if needed in the vault.
  const { availableInStrategy } = await withdrawFromStrategyIfNeeded({
    ctx,
    weth,
    strategy,
    vault,
    availableInVault,
    buffer,
    minStrategyWithdrawAmount,
    dryrun,
  });

  // 6. Remaining amount to source from validators.
  let remainingAmount =
    buffer -
    availableInVault -
    totalPendingPartialWithdrawals -
    availableInStrategy;

  log(`Remaining amount to withdraw ${formatUnits(remainingAmount, 18)}`);

  // 7. Withdraw from validators if necessary.
  if (remainingAmount < 0n) {
    log(`No need to withdraw from the validators.`);
    return;
  }

  const validators: { index: number; pubKey: string; balanceWei: bigint }[] =
    [];
  for (let i = 0; i < activeValidators.length; i++) {
    const validatorIndex = Number(activeValidators[i].index);
    const validator = stateView.validators.get(validatorIndex);
    const balanceGwei = BigInt(stateView.balances.get(validatorIndex));
    validators.push({
      index: validatorIndex,
      pubKey: toHex(validator.pubkey),
      balanceWei: parseUnits(balanceGwei.toString(), 9),
    });
    log(
      `  Validator ${validatorIndex} balance ${formatUnits(balanceGwei, 9)} ETH`
    );
  }

  // Sort validators smallest to highest balance.
  const sortedValidators = validators.sort((a, b) =>
    a.balanceWei < b.balanceWei ? -1 : 1
  );

  for (const validator of sortedValidators) {
    const maxValidatorWithdrawal =
      validator.balanceWei - parseUnits("32.25", 18);
    const withdrawalAmount =
      maxValidatorWithdrawal < remainingAmount
        ? maxValidatorWithdrawal
        : remainingAmount;

    if (withdrawalAmount < minValidatorWithdrawAmount) {
      log(
        `  Skipping validator ${
          validator.index
        } as withdrawal amount ${formatUnits(
          withdrawalAmount,
          18
        )} is less than the minimum partial withdrawal amount`
      );
      continue;
    }

    const withdrawalAmountGwei = withdrawalAmount / parseUnits("1", 9);
    log(
      `  Withdrawing ${formatUnits(
        withdrawalAmountGwei,
        9
      )} ETH from validator ${validator.index}`
    );

    if (!dryrun) {
      await ctx.writeContract(
        { address: strategy.address, abi: strategy.abi },
        "validatorWithdrawal",
        [validator.pubKey as Hex, withdrawalAmountGwei],
        "validatorWithdrawal",
        { value: 1n }
      );
    }

    remainingAmount = remainingAmount - withdrawalAmount;
    if (remainingAmount <= 0n) {
      log(`  Reached the required withdrawal amount`);
      break;
    }
  }

  if (remainingAmount > 0n) {
    log(
      `  Still need to withdraw ${formatUnits(
        remainingAmount,
        18
      )} ETH from the validators next time`
    );
  }
}

/**
 * removeValidator — removes an SSV compounding validator (directly on the
 * strategy or via the ConsolidationController, which takes the strategy address
 * as the first argument). Faithful port of validatorCompound.js#removeValidator.
 */
export async function removeValidator(
  ctx: ActionContext,
  args: { pubkey: string; operatorids: string; consol?: boolean }
): Promise<void> {
  const { pubkey, operatorids, consol = false } = args;

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = splitOperatorIds(operatorids);

  const strategy = ctx.resolveContract({
    deploymentName: "CompoundingStakingSSVStrategyProxy",
    abiFrom: { kind: "inline", abi: strategyAbi },
  }) as unknown as ResolveShim;

  // Cluster details from the SSV API.
  const { cluster } = await getClusterInfo({
    chainId: ctx.chainId,
    operatorids,
    ownerAddress: strategy.address,
  });
  const clusterTuple = normalizeClusterTuple(cluster);

  log(
    `About to remove compounding validator with pubkey ${pubkey} via ${
      consol ? "ConsolidationController" : "CompoundingStakingSSVStrategy"
    }`
  );

  if (consol) {
    const controller = ctx.resolveContract({
      deploymentName: "ConsolidationController",
      abiFrom: { kind: "inline", abi: consolControllerAbi },
    });
    await ctx.writeContract(
      controller,
      "removeSsvValidator",
      [strategy.address, pubkey, operatorIds, clusterTuple],
      "removeSsvValidator"
    );
  } else {
    await ctx.writeContract(
      { address: strategy.address, abi: strategy.abi },
      "removeSsvValidator",
      [pubkey, operatorIds, clusterTuple],
      "removeSsvValidator"
    );
  }
}

// -------------------------------------------------------------------------
// Cluster tuple normalization. getClusterInfo (utils/ssv.js) already returns a
// normalized cluster; ensure the fields are in the on-chain struct order/types
// and coerce the numeric fields to the shapes viem expects. This mirrors what
// ethers did implicitly when passing the object to the contract call.
// -------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeClusterTuple(cluster: any) {
  return {
    validatorCount: Number(cluster.validatorCount),
    networkFeeIndex: BigInt(cluster.networkFeeIndex),
    index: BigInt(cluster.index),
    active: Boolean(cluster.active),
    balance: BigInt(cluster.balance),
  };
}

// Plural aliases requested by the migration brief map to the compounding
// singular implementations (see NOTE at the top of this file).
export const stakeValidators = stakeValidator;
export const registerValidators = registerValidator;
