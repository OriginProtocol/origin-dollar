const ethers = require("ethers");
const {
  defaultAbiCoder,
  formatUnits,
  solidityPack,
  parseUnits,
  arrayify,
} = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { getBeaconBlock } = require("../utils/beacon");
const { bytes32 } = require("../utils/regex");
const { resolveContract } = require("../utils/resolvers");

const {
  generateValidatorPubKeyProof,
  generateFirstPendingDepositSlotProof,
  generateBalancesContainerProof,
  generateBalanceProof,
} = require("../utils/proofs");
const { toHex } = require("../utils/units");
const { logTxDetails } = require("../utils/txLogger");
const { getNetworkName } = require("../utils/hardhat-helpers");

const log = require("../utils/logger")("task:beacon");

/// Returns an ethers provider connected to the Ethereum mainnet or Hoodi.
/// @param {Provider} [provider] - Optional ethers provider connected to local fork or live chain. Uses Hardhat provider if not supplied.
async function getLiveProvider(provider) {
  const networkName = await getNetworkName(provider);
  if (networkName == "hoodi") {
    return new ethers.providers.JsonRpcProvider(process.env.HOODI_PROVIDER_URL);
  }
  // Get provider to Ethereum mainnet and not a local fork
  return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
}

async function requestValidatorWithdraw({ pubkey, amount, signer }) {
  const amountGwei = parseUnits(amount.toString(), 9);

  const data = solidityPack(["bytes", "uint64"], [pubkey, amountGwei]);
  log(`Encoded partial withdrawal data: ${data}`);

  const tx = await signer.sendTransaction({
    to: addresses.mainnet.beaconChainWithdrawRequest,
    data,
    value: 1, // 1 wei for the fee
  });

  await logTxDetails(tx, "requestWithdraw");
}

async function verifyValidator({ slot, index, dryrun, withdrawal, signer }) {
  // Get provider to mainnet or testnet and not a local fork
  const provider = await getLiveProvider(signer.provider);

  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  if (withdrawal) {
    log(`Overriding withdrawal address to ${withdrawal}`);

    // Update the validator's withdrawalCredentials in stateView
    const validator = stateView.validators.get(index);
    if (
      !validator ||
      toHex(validator.node.root) ==
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      throw new Error(`Validator at index ${index} not found for slot ${slot}`);
    }

    log(
      `Original withdrawal credentials: ${toHex(
        validator.withdrawalCredentials
      )}`
    );

    // Override the address in the withdrawal credentials
    validator.withdrawalCredentials = arrayify(
      `0x020000000000000000000000${withdrawal.slice(2)}`
    );
    stateView.validators.set(index, validator); // Update validator in state

    // Update blockTree with new stateRoot
    const stateRootGindex = blockView.type.getPathInfo(["stateRoot"]).gindex;
    blockTree.setNode(stateRootGindex, stateView.node);
  }

  const nextBlock = blockView.body.executionPayload.blockNumber + 1;
  const { timestamp: nextBlockTimestamp } = await provider.getBlock(nextBlock);
  log(
    `Next execution layer block ${nextBlock} has timestamp ${nextBlockTimestamp}`
  );

  const {
    proof,
    leaf: pubKeyHash,
    root: beaconBlockRoot,
    pubKey,
  } = await generateValidatorPubKeyProof({
    validatorIndex: index,
    blockView,
    blockTree,
    stateView,
  });

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  if (dryrun) {
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`nextBlockTimestamp: ${nextBlockTimestamp}`);
    console.log(`validator index: ${index}`);
    console.log(`pubKeyHash: ${pubKeyHash}`);
    console.log(`proof:\n${proof}`);
    return;
  }

  log(
    `About verify validator ${index} with pub key ${pubKey}, pub key hash ${pubKeyHash} at slot ${blockView.slot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyValidator(nextBlockTimestamp, index, pubKeyHash, proof);
  await logTxDetails(tx, "verifyValidator");
}

async function verifyDeposit({ slot, root: depositDataRoot, dryrun, signer }) {
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const {
    slot: depositSlot,
    amountGwei,
    pubKeyHash,
    status,
  } = await strategy.deposits(depositDataRoot);
  if (depositSlot == 0) {
    throw Error(`Failed to find deposit with root ${depositDataRoot}`);
  }
  log(
    `Verifying deposit of ${formatUnits(
      amountGwei,
      9
    )} ETH at slot ${depositSlot} with public key hash ${pubKeyHash}`
  );
  if (status !== 1) {
    throw Error(
      `Deposit with root ${depositDataRoot} is not Pending. Status: ${status}`
    );
  }

  // Uses the latest slot if the slot is undefined
  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  const processedSlot = blockView.slot;

  const {
    proof,
    slot: firstPendingDepositSlot,
    root: beaconBlockRoot,
  } = await generateFirstPendingDepositSlotProof({
    blockView,
    blockTree,
    stateView,
  });

  if (depositSlot > firstPendingDepositSlot && firstPendingDepositSlot != 0) {
    throw Error(
      `Deposit at slot ${depositSlot} has not been processed at slot ${processedSlot}. Next deposit in the queue is from slot ${firstPendingDepositSlot}.`
    );
  }

  if (dryrun) {
    console.log(`deposit slot                 : ${depositSlot}`);
    console.log(`deposit data root            : ${depositDataRoot}`);
    console.log(`beacon block root            : ${beaconBlockRoot}`);
    console.log(`processed slot               : ${processedSlot}`);
    console.log(`slot of first pending deposit: ${firstPendingDepositSlot}`);
    console.log(`proof: ${proof}`);
    return;
  }

  log(
    `About to verify deposit from slot ${depositSlot} with processing slot ${processedSlot}, deposit data root ${depositDataRoot}, slot of first pending deposit ${firstPendingDepositSlot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyDeposit(
      depositDataRoot,
      processedSlot,
      firstPendingDepositSlot,
      proof
    );
  await logTxDetails(tx, "verifyDeposit");
}

async function verifyBalances({ root, indexes, dryrun, signer }) {
  if (!root) {
    if (!dryrun) {
      // TODO If no beacon block root, then get from the blockRoot from the last BalancesSnapped event
      // Revert for now
      throw Error("Beacon block root is currently required for verifyBalances");
    }

    root = "head";
  }

  // Uses the beacon chain data for the beacon block root
  const { blockView, blockTree, stateView } = await getBeaconBlock(root);

  const beaconBlockRoot = toHex(blockView.hashTreeRoot());
  const verificationSlot = blockView.slot;

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const { proof: firstPendingDepositSlotProof, slot: firstPendingDepositSlot } =
    await generateFirstPendingDepositSlotProof({
      blockView,
      blockTree,
      stateView,
    });

  const { leaf: balancesContainerRoot, proof: balancesContainerProof } =
    await generateBalancesContainerProof({
      blockView,
      blockTree,
      stateView,
    });

  const verifiedValidators = indexes
    ? indexes.split(",").map((index) => ({
        index,
      }))
    : await strategy.getVerifiedValidators();

  const validatorBalanceLeaves = [];
  const validatorBalanceProofs = [];
  const validatorBalances = [];
  for (const validator of verifiedValidators) {
    const { proof, leaf, balance } = await generateBalanceProof({
      validatorIndex: validator.index,
      blockView,
      blockTree,
      stateView,
    });
    validatorBalanceLeaves.push(leaf);
    validatorBalanceProofs.push(proof);
    validatorBalances.push(balance);

    log(
      `Validator ${validator.index} has balance: ${formatUnits(balance, 9)} ETH`
    );
  }

  if (dryrun) {
    console.log(`verificationSlot: ${verificationSlot}`);
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`firstPendingDepositSlot: ${firstPendingDepositSlot}`);
    console.log(
      `firstPendingDepositSlotProof:\n${firstPendingDepositSlotProof}`
    );
    console.log(`\nbalancesContainerRoot: ${balancesContainerRoot}`);
    console.log(`\nbalancesContainerProof:\n${balancesContainerProof}`);
    console.log(
      `\nvalidatorBalanceLeaves:\n[${validatorBalanceLeaves
        .map((leaf) => `"${leaf}"`)
        .join(",\n")}]`
    );
    console.log(
      `\nvalidatorBalanceProofs:\n[${validatorBalanceProofs
        .map((proof) => `"${proof}"`)
        .join(",\n")}]`
    );
    console.log(
      `validatorBalances: ${validatorBalances
        .map((bal) => formatUnits(bal, 9))
        .join(", ")}`
    );
    return;
  }

  log(
    `About to verify ${verifiedValidators.length} validator balances for slot ${verificationSlot} with first pending deposit slot ${firstPendingDepositSlot} to beacon block root ${beaconBlockRoot}`
  );
  const tx = await strategy.connect(signer).verifyBalances({
    blockRoot: beaconBlockRoot,
    firstPendingDepositSlot,
    firstPendingDepositSlotProof,
    balancesContainerRoot,
    balancesContainerProof,
    validatorBalanceLeaves,
    validatorBalanceProofs,
  });
  await logTxDetails(tx, "verifyBalances");
}

async function beaconRoot({ block, live, signer }) {
  // Either use live chain or local fork to get the block timestamp
  const provider = live
    ? await getLiveProvider(signer.provider)
    : signer.provider;

  // Get timestamp of the block
  const fetchedBlock = await provider.getBlock(block);
  if (fetchedBlock == null) throw Error(`Block ${block} not found`);

  const { timestamp } = fetchedBlock;
  log(`Block ${block} has timestamp ${timestamp}`);

  const data = defaultAbiCoder.encode(["uint256"], [timestamp]);
  log(`Encoded timestamp data: ${data}`);

  // The Beacon Roots contract is the same on mainnet and Hoodi
  const beaconRootsAddress = addresses.mainnet.beaconRoots;
  const root = await provider.call(
    {
      to: beaconRootsAddress,
      data,
    },
    block // blockTag
  );

  if (!root.match(bytes32)) {
    throw Error(
      `Could not find parent beacon block root for block ${block} with timestamp ${timestamp} in ${beaconRootsAddress}.`
    );
  }

  console.log(`Block ${block} has parent beacon block root ${root}`);

  return { root, timestamp };
}

async function getValidator({ slot, index }) {
  // Uses the latest slot if the slot is undefined
  const { blockView, stateView } = await getBeaconBlock(slot);

  const validator = stateView.validators.get(index);
  if (
    !validator ||
    toHex(validator.node.root) ==
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    throw new Error(`Validator at index ${index} not found for slot ${slot}`);
  }

  const balance = stateView.balances.get(index);

  console.log(`Validator at index ${index} for slot ${stateView.slot}:`);
  console.log(`Public Key                  : ${toHex(validator.pubkey)}`);
  console.log(
    `Withdrawal Credentials      : ${toHex(validator.withdrawalCredentials)}`
  );
  console.log(`Actual Balance              : ${formatUnits(balance, 9)} ETH`);
  console.log(
    `Effective Balance           : ${formatUnits(
      validator.effectiveBalance,
      9
    )} ETH`
  );
  console.log(`Slashed                     : ${validator.slashed}`);
  console.log(`Activation Epoch            : ${validator.activationEpoch}`);
  console.log(`Exit Epoch                  : ${validator.exitEpoch}`);
  console.log(`Withdrawable Epoch          : ${validator.withdrawableEpoch}`);
  console.log(
    `Activation Eligibility Epoch: ${validator.activationEligibilityEpoch}`
  );

  let depositsFound = 0;
  let totalDeposits = 0;
  for (let i = 0; i < stateView.pendingDeposits.length; i++) {
    const deposit = stateView.pendingDeposits.get(i);
    if (Buffer.from(deposit.pubkey).equals(validator.pubkey)) {
      console.log(
        `  pending deposit for ${formatUnits(deposit.amount, 9)}, slot ${
          deposit.slot
        }, withdrawal credential ${toHex(
          deposit.withdrawalCredentials
        )} at position ${i}`
      );
      // console.log(`signature ${toHex(deposit.signature)}`);
      depositsFound++;
      totalDeposits += deposit.amount;
    }
  }
  console.log(
    `${depositsFound} pending deposits worth ${formatUnits(
      totalDeposits,
      9
    )} for validator in ${stateView.pendingDeposits.length} pending deposits`
  );

  let partialWithdrawalsFound = 0;
  let totalPartialWithdrawals = 0n;
  for (let i = 0; i < stateView.pendingPartialWithdrawals.length; i++) {
    const withdrawal = stateView.pendingPartialWithdrawals.get(i);
    log(
      `Pending partial withdrawal for validator ${
        withdrawal.validatorIndex
      }, amount ${formatUnits(withdrawal.amount, 9)} and withdrawable epoch ${
        withdrawal.withdrawableEpoch
      }`
    );
    if (withdrawal.validatorIndex == index) {
      console.log(
        `  pending partial withdrawal for ${formatUnits(
          withdrawal.amount,
          9
        )} ETH at position ${i} with withdrawable epoch ${
          withdrawal.withdrawableEpoch
        }`
      );
      partialWithdrawalsFound++;
      totalPartialWithdrawals = totalPartialWithdrawals + withdrawal.amount;
    }
  }
  console.log(
    `${partialWithdrawalsFound} pending partial withdrawals worth ${formatUnits(
      totalPartialWithdrawals,
      9
    )} ETH for validator in ${
      stateView.pendingPartialWithdrawals.length
    } pending withdrawals`
  );

  let withdrawals = 0;
  for (let i = 0; i < blockView.body.executionPayload.withdrawals.length; i++) {
    const withdrawal = blockView.body.executionPayload.withdrawals.get(i);
    log(
      `Withdrawal ${withdrawal.index} for validator ${
        withdrawal.validatorIndex
      }, amount ${formatUnits(withdrawal.amount, 9)}, address ${toHex(
        withdrawal.address
      )}`
    );
    if (withdrawal.validatorIndex == index) {
      console.log(`Found withdrawal at position ${i}`);
      console.log(`amount : ${formatUnits(withdrawal.amount, 9)} ETH`);
      console.log(`address: ${toHex(withdrawal.address)}`);
      withdrawals++;
    }
  }
  console.log(
    `${withdrawals} withdrawals for validator in ${blockView.body.executionPayload.withdrawals.length} withdrawals`
  );

  let withdrawalRequests = 0;
  for (
    let i = 0;
    i < blockView.body.executionRequests.withdrawals.length;
    i++
  ) {
    const withdrawalRequest =
      blockView.body.executionRequests.withdrawals.get(i);
    log(
      `Withdrawal request for validator ${toHex(
        withdrawalRequest.validatorPubkey
      )}, amount ${formatUnits(
        withdrawalRequest.amount,
        9
      )} and source address ${toHex(withdrawalRequest.sourceAddress)}`
    );
    if (
      Buffer.from(withdrawalRequest.validatorPubkey).equals(validator.pubkey)
    ) {
      console.log(
        `Found withdrawal request at position ${i} on the execution layer`
      );
      console.log(`amount : ${formatUnits(withdrawalRequest.amount, 9)} ETH`);
      console.log(`address: ${toHex(withdrawalRequest.sourceAddress)}`);
      withdrawalRequests++;
    }
  }
  console.log(
    `${withdrawalRequests} withdrawal requests on the execution layer found for validator in ${blockView.body.executionRequests.withdrawals.length} requests`
  );

  let validatorExits = 0;
  for (let i = 0; i < blockView.body.voluntaryExits.length; i++) {
    const exit = blockView.body.voluntaryExits.get(i);
    log(
      `Voluntary exit for validator ${exit.message.validatorIndex}, epoch ${exit.message.epoch}`
    );
    if (exit.message.validatorIndex == index) {
      console.log(`Found voluntary exit at position ${i}`);
      console.log(`epoch: ${exit.message.epoch}`);
      validatorExits++;
    }
  }
  console.log(
    `${validatorExits} voluntary exits found for validator in ${blockView.body.voluntaryExits.length} exits`
  );

  console.log(
    `Next withdrawable validator is ${stateView.nextWithdrawalValidatorIndex} with withdrawal index ${stateView.nextWithdrawalIndex}`
  );
  const currentEpoch = Math.floor(blockView.slot / 32);
  const earliestExitEpochDiff = stateView.earliestExitEpoch - currentEpoch;
  const daysToExit = Number(
    (earliestExitEpochDiff * 12 * 32) / (24 * 60 * 60) // 12 seconds per slot and 32 slots in an epoch, 24 hours in a day
  ).toFixed(2);
  console.log(
    `Earliest exit epoch is ${stateView.earliestExitEpoch} which is ${earliestExitEpochDiff} epochs (${daysToExit} days) away from the current epoch ${currentEpoch}`
  );
}

module.exports = {
  requestValidatorWithdraw,
  beaconRoot,
  getValidator,
  verifyValidator,
  verifyDeposit,
  verifyBalances,
};
