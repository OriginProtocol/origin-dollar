#!/usr/bin/env node

process.env.DEBUG = "";

const { ethers } = require("ethers");
const { getBeaconBlock, hashPubKey } = require("../../utils/beacon");
const {
  generateBalancesContainerProof,
  generateBalanceProof,
  generatePendingDepositsContainerProof,
  generatePendingDepositProof,
  generateValidatorPubKeyProof,
  generateValidatorWithdrawableEpochProof,
  generateFirstPendingDepositSlotProof,
} = require("../../utils/proofs");

const DEFAULT_WITHDRAWAL_CREDENTIAL =
  "0x020000000000000000000000f80432285c9d2055449330bbd7686a5ecf2a7247";
const DEFAULT_SLOT = 12235962;
const PUBKEY_VALIDATOR_INDEX = 1804300;
const NON_EXITING_VALIDATOR_INDEX = 1804301;
const EXITED_VALIDATOR_INDEX = 1804300;
const BALANCE_VALIDATOR_INDEX = 1804300;
const PENDING_DEPOSIT_INDEX = 2;

function parseSlotArg() {
  if (process.argv.length < 3) {
    return DEFAULT_SLOT;
  }

  const parsed = Number(process.argv[2]);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid slot argument: ${process.argv[2]}`);
  }
  return parsed;
}

async function main() {
  const slot = parseSlotArg();
  const { blockView, blockTree, stateView } = await getBeaconBlock(
    slot,
    "mainnet"
  );
  const beaconBlockRoot = ethers.utils.hexlify(blockView.hashTreeRoot());

  const validatorPubKey = await generateValidatorPubKeyProof({
    blockView,
    blockTree,
    stateView,
    validatorIndex: PUBKEY_VALIDATOR_INDEX,
  });

  const nonExitingWithdrawable = await generateValidatorWithdrawableEpochProof({
    blockView,
    blockTree,
    stateView,
    validatorIndex: NON_EXITING_VALIDATOR_INDEX,
  });

  const exitedWithdrawable = await generateValidatorWithdrawableEpochProof({
    blockView,
    blockTree,
    stateView,
    validatorIndex: EXITED_VALIDATOR_INDEX,
  });

  const balancesContainer = await generateBalancesContainerProof({
    blockView,
    blockTree,
    stateView,
  });

  const validatorBalance = await generateBalanceProof({
    blockView,
    blockTree,
    stateView,
    validatorIndex: BALANCE_VALIDATOR_INDEX,
  });

  const pendingDepositsContainer = await generatePendingDepositsContainerProof({
    blockView,
    blockTree,
    stateView,
  });

  const pendingDeposit = await generatePendingDepositProof({
    blockView,
    blockTree,
    stateView,
    depositIndex: PENDING_DEPOSIT_INDEX,
  });

  const firstPendingDeposit = await generateFirstPendingDepositSlotProof({
    blockView,
    blockTree,
    stateView,
  });

  const payload = {
    slot: String(slot),
    beaconBlockRoot,
    validatorPubKey: {
      validatorIndex: String(PUBKEY_VALIDATOR_INDEX),
      proof: validatorPubKey.proof,
      leaf: validatorPubKey.leaf,
      root: validatorPubKey.root,
      pubKey: validatorPubKey.pubKey,
      pubKeyHash: hashPubKey(validatorPubKey.pubKey),
      withdrawalCredential: DEFAULT_WITHDRAWAL_CREDENTIAL,
    },
    validatorWithdrawableNonExiting: {
      validatorIndex: String(NON_EXITING_VALIDATOR_INDEX),
      proof: nonExitingWithdrawable.proof,
      withdrawableEpoch: String(nonExitingWithdrawable.withdrawableEpoch),
      root: nonExitingWithdrawable.root,
    },
    validatorWithdrawableExited: {
      validatorIndex: String(EXITED_VALIDATOR_INDEX),
      proof: exitedWithdrawable.proof,
      withdrawableEpoch: String(exitedWithdrawable.withdrawableEpoch),
      root: exitedWithdrawable.root,
    },
    balancesContainer: {
      proof: balancesContainer.proof,
      leaf: balancesContainer.leaf,
      root: balancesContainer.root,
    },
    validatorBalance: {
      validatorIndex: String(BALANCE_VALIDATOR_INDEX),
      proof: validatorBalance.proof,
      leaf: validatorBalance.leaf,
      root: validatorBalance.root,
      balance: String(validatorBalance.balance),
    },
    pendingDepositsContainer: {
      proof: pendingDepositsContainer.proof,
      leaf: pendingDepositsContainer.leaf,
      root: pendingDepositsContainer.root,
    },
    pendingDeposit: {
      depositIndex: String(PENDING_DEPOSIT_INDEX),
      proof: pendingDeposit.proof,
      leaf: pendingDeposit.leaf,
      root: pendingDeposit.root,
    },
    firstPendingDeposit: {
      proof: firstPendingDeposit.proof,
      root: firstPendingDeposit.root,
      leaf: firstPendingDeposit.leaf,
      slot: String(firstPendingDeposit.slot),
      isEmpty: firstPendingDeposit.isEmpty,
    },
  };

  process.stdout.write(JSON.stringify(payload));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
