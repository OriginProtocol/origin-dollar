const ethers = require("ethers");
const {
  defaultAbiCoder,
  formatUnits,
  solidityPack,
  parseUnits,
  arrayify,
} = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const {
  getBeaconBlock,
  getValidator: getValidatorBeacon,
  calcBlockTimestamp,
} = require("../utils/beacon");
const { bytes32 } = require("../utils/regex");
const { resolveContract } = require("../utils/resolvers");
const {
  generateValidatorPubKeyProof,
  generateFirstPendingDepositProof,
  generateValidatorWithdrawableEpochProof,
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

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

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
  } else {
    withdrawal = strategy.address;
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

  // Check the validator is in STAKED state
  const stateEnum = (await strategy.validator(pubKeyHash)).state;
  log(`Validator with pub key hash ${pubKeyHash} has state: ${stateEnum}`);
  if (stateEnum !== 2)
    // STAKED
    throw Error(
      `Validator ${index} with pub key hash ${pubKeyHash} is not STAKED. Status: ${stateEnum}`
    );

  if (dryrun) {
    console.log(`beaconBlockRoot   : ${beaconBlockRoot}`);
    console.log(`nextBlockTimestamp: ${nextBlockTimestamp}`);
    console.log(`validator index   : ${index}`);
    console.log(`pubKeyHash        : ${pubKeyHash}`);
    console.log(`withdrawal address: ${withdrawal}`);
    console.log(`Validator status  : ${stateEnum}`);
    console.log(`proof:\n${proof}`);
    return;
  }

  log(
    `About verify validator ${index} with pub key ${pubKey}, pub key hash ${pubKeyHash}, withdrawal ${withdrawal} at slot ${blockView.slot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyValidator(nextBlockTimestamp, index, pubKeyHash, withdrawal, proof);
  await logTxDetails(tx, "verifyValidator");
}

async function verifyDeposit({
  slot,
  id: depositID,
  valSlot: firstDepositValidatorCreatedSlot,
  dryrun,
  test,
  index: strategyValidatorIndex,
  signer,
}) {
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  let strategyDepositSlot = 0;
  if (!test) {
    const depositData = await strategy.deposits(depositID);
    log(
      `Found deposit for ${formatUnits(
        depositData.amountGwei,
        9
      )} ETH, from slot ${depositData.slot} with public key hash ${
        depositData.pubKeyHash
      } and deposit index ${depositData.depositIndex}`
    );
    const validatorStatus = (await strategy.validator(depositData.pubKeyHash))
      .state;
    if (validatorStatus !== 3)
      throw Error(
        `Validator with pub key hash ${depositData.pubKeyHash} is not VERIFIED. Status: ${validatorStatus}`
      );

    const { slot, amountGwei, pubKeyHash, status } = await strategy.deposits(
      depositID
    );
    strategyDepositSlot = slot;
    if (strategyDepositSlot == 0) {
      throw Error(`Failed to find deposit with ID ${depositID}`);
    }
    log(
      `Verifying deposit of ${formatUnits(
        amountGwei,
        9
      )} ETH at slot ${strategyDepositSlot} with public key hash ${pubKeyHash}`
    );
    if (status !== 1) {
      throw Error(
        `Deposit with ID ${depositID} is not Pending. Status: ${status}`
      );
    }

    const strategyValidator = await strategy.validator(pubKeyHash);
    strategyValidatorIndex = strategyValidator.index;
  }

  // Uses the latest slot if the slot is undefined
  const depositProcessedBeaconData = await getBeaconBlock(slot);
  const depositProcessedSlot = depositProcessedBeaconData.blockView.slot;

  // if generating unit testing data
  if (test) {
    // change the slot of the first pending deposit to be 2 years in the future
    // to ensure the unit test deposit has been processed
    const firstPendingDeposit =
      depositProcessedBeaconData.stateView.pendingDeposits.get(0);
    log(`Original first pending deposit slot: ${firstPendingDeposit.slot}`);

    // There are 2,628,000 12 second slots per year
    firstPendingDeposit.slot = depositProcessedSlot + 2 * 2628000;
    log(`Testing first pending deposit slot: ${firstPendingDeposit.slot}`);
    depositProcessedBeaconData.stateView.pendingDeposits.set(
      0,
      firstPendingDeposit
    );

    const stateRootGIndex =
      depositProcessedBeaconData.blockView.type.getPropertyGindex("stateRoot");
    // Patching the tree by attaching the state in the `stateRoot` field of the block.
    depositProcessedBeaconData.blockTree.setNode(
      stateRootGIndex,
      depositProcessedBeaconData.stateView.node
    );
  }

  // Generate a proof of the first pending deposit
  const {
    proof: pendingDepositPubKeyProof,
    slot: firstPendingDepositSlot,
    pubkeyHash: firstPendingDepositPubKeyHash,
    validatorIndex: firstPendingDepositValidatorIndex,
    root: processedBeaconBlockRoot,
  } = await generateFirstPendingDepositProof({
    ...depositProcessedBeaconData,
    test,
  });

  // Generate a proof that the validator of the first pending deposit is not exiting
  if (!firstDepositValidatorCreatedSlot) {
    firstDepositValidatorCreatedSlot = depositProcessedSlot + 32;
    log(
      `Using slot ${firstDepositValidatorCreatedSlot} to see if the first pending deposit validator is exiting`
    );
  }
  const depositValidatorBeaconData = await getBeaconBlock(
    firstDepositValidatorCreatedSlot
  );

  const {
    root: validatorBeaconBlockRoot,
    proof: firstDepositValidatorWithdrawableEpochProof,
    withdrawableEpoch,
    validatorPubKeyProof: firstDepositValidatorValidatorPubKeyProof,
  } = await generateValidatorWithdrawableEpochProof({
    ...depositValidatorBeaconData,
    validatorIndex: firstPendingDepositValidatorIndex,
    includePubKeyProof: true,
  });

  if (firstPendingDepositSlot == 0 && !test) {
    throw Error(
      `Can not verify when the first pending deposits has a zero slot. This is from a validator consolidating to a compounding validator.\nExecute again when the first pending deposit slot is not zero.`
    );
  }
  if (strategyDepositSlot > firstPendingDepositSlot) {
    throw Error(
      `Deposit at slot ${strategyDepositSlot} has not been processed at slot ${depositProcessedSlot}. Next deposit in the queue is from slot ${firstPendingDepositSlot}.`
    );
  }

  // Generate a proof of the withdrawable epoch for the strategy's validator to deposit is going to
  const {
    proof: strategyValidatorWithdrawableEpochProof,
    withdrawableEpoch: strategyValidatorWithdrawableEpoch,
  } = await generateValidatorWithdrawableEpochProof({
    ...depositProcessedBeaconData,
    validatorIndex: strategyValidatorIndex,
    includePubKeyProof: false,
  });

  const firstPendingDeposit = {
    slot: firstPendingDepositSlot,
    validatorIndex: firstPendingDepositValidatorIndex,
    pubKeyHash: firstPendingDepositPubKeyHash,
    pendingDepositPubKeyProof,
    withdrawableEpochProof: firstDepositValidatorWithdrawableEpochProof,
    validatorPubKeyProof: firstDepositValidatorValidatorPubKeyProof,
  };
  const strategyValidator = {
    withdrawableEpoch: strategyValidatorWithdrawableEpoch.toString(),
    withdrawableEpochProof: strategyValidatorWithdrawableEpochProof,
  };

  if (dryrun) {
    console.log(
      `deposit slot                              : ${strategyDepositSlot}`
    );
    console.log(`deposit ID                                : ${depositID}`);
    console.log(
      `beacon block root                         : ${processedBeaconBlockRoot}`
    );
    console.log(
      `deposit processed slot                    : ${depositProcessedSlot}`
    );
    console.log(
      `first pending deposit pubkey.             : ${firstPendingDepositPubKeyHash}`
    );
    console.log(
      `first pending deposit index               : ${firstPendingDepositValidatorIndex}`
    );
    console.log(
      `first pending deposit withdrawable epoch. : ${withdrawableEpoch}`
    );
    console.log(
      `first pending deposit slot                : ${firstPendingDepositSlot}`
    );
    console.log(
      `first pending deposit pub key proof       : ${pendingDepositPubKeyProof}`
    );
    console.log(
      `first deposit validator withdrawable proof: ${firstDepositValidatorWithdrawableEpochProof}`
    );
    console.log(
      `first deposit validator public key proof  : ${firstDepositValidatorValidatorPubKeyProof}`
    );
    console.log(
      `Strategy validator index.                 : ${strategyValidatorIndex}`
    );
    console.log(
      `Strategy validator withdrawable epoch.    : ${strategyValidatorWithdrawableEpoch}`
    );
    console.log(
      `Strategy validator withdrawable proof     : ${strategyValidatorWithdrawableEpochProof}`
    );
    return;
  }

  if (test) {
    console.log(
      JSON.stringify(
        {
          firstPendingDeposit,
          strategyValidator,
          processedBeaconBlockRoot,
          validatorBeaconBlockRoot,
        },
        null,
        2
      )
    );
    return;
  }

  log(
    `About to verify deposit from slot ${strategyDepositSlot} with processing slot ${depositProcessedSlot}, deposit ID ${depositID}, slot of first pending deposit ${firstPendingDepositSlot} to beacon block root ${processedBeaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyDeposit(
      depositID,
      depositProcessedSlot,
      firstDepositValidatorCreatedSlot,
      firstPendingDeposit,
      strategyValidator
    );
  await logTxDetails(tx, "verifyDeposit");
}

async function verifyBalances({
  indexes,
  dryrun,
  test,
  signer,
  slot,
  valSlot: firstDepositValidatorCreatedSlot,
}) {
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );
  const strategyView = await resolveContract("CompoundingStakingStrategyView");

  if (!slot) {
    if (!test) {
      const { blockRoot } = await strategy.snappedBalance();
      slot = blockRoot;
      log(`Using slot with block root ${slot} for verifying balances`);
    } else {
      slot = "head";
    }
  }

  // Uses the beacon chain data for the beacon block root
  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);
  const verificationSlot = blockView.slot;
  const networkName = await getNetworkName();
  // Set the slot when the validator of the first pending deposit was created
  firstDepositValidatorCreatedSlot =
    firstDepositValidatorCreatedSlot || verificationSlot + 32;
  const firstDepositValidatorBlockTimestamp = calcBlockTimestamp(
    // Use the next slot as we are getting the parent block root
    firstDepositValidatorCreatedSlot + 1,
    networkName
  );

  const {
    proof: pendingDepositPubKeyProof,
    slot: firstPendingDepositSlot,
    validatorIndex: firstPendingDepositValidatorIndex,
    pubkeyHash: firstPendingDepositPubKeyHash,
    root: snapBalancesBlockRoot,
    isEmpty,
  } = await generateFirstPendingDepositProof({
    blockView,
    blockTree,
    stateView,
    test,
  });

  // If the deposit queue is not empty and the first pending deposit slot is zero
  if (!isEmpty && firstPendingDepositSlot == 0 && !test) {
    throw Error(
      `Can not verify when the first pending deposits has a zero slot. This is from a validator consolidating to a compounding validator.\nExecute another snapBalances when the first pending deposit slot is not zero.`
    );
  }

  // Verify the first pending deposit is not exiting
  const depositValidatorBeaconData =
    firstDepositValidatorCreatedSlot == verificationSlot
      ? { blockView, blockTree, stateView }
      : await getBeaconBlock(firstDepositValidatorCreatedSlot);

  const {
    proof: firstDepositValidatorWithdrawableEpochProof,
    validatorPubKeyProof: firstDepositValidatorValidatorPubKeyProof,
    root: firstDepositValidatorBlockRoot,
  } = await generateValidatorWithdrawableEpochProof({
    ...depositValidatorBeaconData,
    validatorIndex: firstPendingDepositValidatorIndex,
    includePubKeyProof: true,
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
    : await strategyView.getVerifiedValidators();

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
  const validatorBalancesFormatted = validatorBalances.map((bal) =>
    formatUnits(bal, 9)
  );

  if (dryrun) {
    console.log(`snapped slot                      : ${verificationSlot}`);
    console.log(`snap balances block root          : ${snapBalancesBlockRoot}`);
    console.log(
      `validator verification slot       : ${firstDepositValidatorCreatedSlot}`
    );
    console.log(
      `validator verification next timestamp : ${firstDepositValidatorBlockTimestamp}`
    );
    console.log(
      `validator verification block root : ${firstDepositValidatorBlockRoot}`
    );
    console.log(
      `first pending deposit slot        : ${firstPendingDepositSlot}`
    );
    console.log(
      `firstPendingDepositPubKeyProof    :\n${pendingDepositPubKeyProof}`
    );
    console.log(`\nbalancesContainerRoot           : ${balancesContainerRoot}`);
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
      `validatorBalances: [${validatorBalancesFormatted.join(", ")}]`
    );
    return;
  }

  const firstPendingDeposit = {
    slot: firstPendingDepositSlot,
    validatorIndex: firstPendingDepositValidatorIndex,
    pubKeyHash: firstPendingDepositPubKeyHash,
    pendingDepositPubKeyProof,
    withdrawableEpochProof: firstDepositValidatorWithdrawableEpochProof,
    validatorPubKeyProof: firstDepositValidatorValidatorPubKeyProof,
  };
  const balanceProofs = {
    balancesContainerRoot,
    balancesContainerProof,
    validatorBalanceLeaves,
    validatorBalanceProofs,
  };

  if (test) {
    console.log(
      JSON.stringify(
        {
          snapBalancesBlockRoot,
          firstDepositValidatorBlockRoot,
          firstDepositValidatorBlockTimestamp:
            firstDepositValidatorBlockTimestamp.toString(),
          firstPendingDeposit,
          balanceProofs,
          validatorBalances: validatorBalancesFormatted,
        },
        null,
        2
      )
    );
    return;
  }

  log(
    `About to verify ${verifiedValidators.length} validator balances for slot ${verificationSlot} with first pending deposit slot ${firstPendingDepositSlot} to beacon block root ${snapBalancesBlockRoot}`
  );
  log(firstPendingDeposit);
  log(balanceProofs);
  const tx = await strategy
    .connect(signer)
    .verifyBalances(
      firstDepositValidatorBlockTimestamp.toString(),
      firstPendingDeposit,
      balanceProofs
    );
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

async function getValidator({ slot, index, pubkey }) {
  if (!index && !pubkey) {
    throw new Error("Either `index` or `pubkey` parameter is required");
  }

  if (pubkey) {
    const apiValidator = await getValidatorBeacon(pubkey);
    index = apiValidator.validatorindex;
  }

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
