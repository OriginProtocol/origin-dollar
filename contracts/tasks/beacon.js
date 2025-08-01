const ethers = require("ethers");
const {
  defaultAbiCoder,
  formatUnits,
  solidityPack,
  parseUnits,
  arrayify,
} = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { getBeaconBlock, getSlot } = require("../utils/beacon");
const { resolveContract } = require("../utils/resolvers");

const {
  generateSlotProof,
  generateBlockProof,
  generateValidatorPubKeyProof,
  generateFirstPendingDepositSlotProof,
  generateBalancesContainerProof,
  generateBalanceProof,
} = require("../utils/proofs");
const { toHex } = require("../utils/units");
const { logTxDetails } = require("../utils/txLogger");
const { networkMap } = require("../utils/hardhat-helpers");

const log = require("../utils/logger")("task:beacon");

async function getLiveProvider(signer) {
  const { chainId } = await signer.provider.getNetwork();
  const network = networkMap[chainId];
  if (network == "hoodi") {
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

async function verifySlot({ block, slot, dryrun, signer, live }) {
  // Either use live chain or local fork
  const providerLive = live ? await getLiveProvider(signer) : signer.provider;

  if (!block && !slot) {
    block = await providerLive.getBlockNumber();
    block -= 1; // Use the previous block
    log(`Using the second last block ${block} for verification`);
  }

  let nextBlockTimestamp;
  // If a block was supplied, we need to work out the slot
  if (block) {
    // Get the timestamp of the next block
    const nextBlock = block + 1;
    const { root: blockRoot, timestamp } = await beaconRoot({
      live,
      block: nextBlock,
      signer,
    });
    nextBlockTimestamp = timestamp;

    slot = await getSlot(blockRoot);
    log(`Slot for block ${block} is:`, slot);
  }

  const { blockView, blockTree } = await getBeaconBlock(slot);

  // If a slot was supplied we need to work out the next block
  if (!block) {
    block = blockView.body.executionPayload.blockNumber;
    log(`Using block ${block} for slot ${slot}`);

    const nextBlock = block + 1;
    const { timestamp } = await providerLive.getBlock(nextBlock);
    nextBlockTimestamp = timestamp;
    log(`Next mainnet block ${nextBlock} has timestamp ${nextBlockTimestamp}`);
  }

  const { proof: slotProofBytes, root: beaconBlockRoot } =
    await generateSlotProof({
      blockView,
      blockTree,
    });

  const { proof: blockNumberProofBytes } = await generateBlockProof({
    blockView,
    blockTree,
  });

  const oracle = await resolveContract("BeaconOracle");

  if (dryrun) {
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`nextBlockTimestamp: ${nextBlockTimestamp}`);
    console.log(`block: ${block}`);
    console.log(`slot: ${slot}`);
    console.log(`slotProofBytes: ${slotProofBytes}`);
    console.log(`blockNumberProofBytes: ${blockNumberProofBytes}`);
    return;
  }

  log(
    `About to verify block ${block} and slot ${slot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await oracle
    .connect(signer)
    .verifySlot(
      nextBlockTimestamp,
      block,
      slot,
      slotProofBytes,
      blockNumberProofBytes
    );
  await logTxDetails(tx, "verifySlot");
}

async function verifyValidator({ slot, index, dryrun, withdrawal, signer }) {
  // Get provider to mainnet or testnet and not a local fork
  const provider = await getLiveProvider(signer);

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

async function verifyDeposit({
  block,
  slot,
  root: depositDataRoot,
  dryrun,
  signer,
}) {
  // TODO If no block then get the block from the stakeETH event
  // For now we'll throw an error
  if (!block) throw Error("Block is currently required for verifyDeposit");

  if (!dryrun) {
    // Check the deposit block has been mapped in the Beacon Oracle
    const oracle = await resolveContract("BeaconOracle");
    const isMapped = await oracle.isBlockMapped(block);
    if (!isMapped) {
      log(`Block ${block} is not mapped in the Beacon Oracle`);
      await verifySlot({ block });
    }
  }

  // Uses the latest slot if the slot is undefined
  const { blockView, blockTree, stateView } = await getBeaconBlock(slot);

  const processedSlot = blockView.slot;

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const {
    proof,
    slot: firstPendingDepositSlot,
    root: beaconBlockRoot,
  } = await generateFirstPendingDepositSlotProof({
    blockView,
    blockTree,
    stateView,
  });

  if (dryrun) {
    console.log(`depositDataRoot: ${depositDataRoot}`);
    console.log(`beaconBlockRoot: ${beaconBlockRoot}`);
    console.log(`block: ${block}`);
    console.log(`processedSlot: ${processedSlot}`);
    console.log(`firstPendingDepositSlot: ${firstPendingDepositSlot}`);
    console.log(`proof: ${proof}`);
    return;
  }

  log(
    `About to verify deposit for deposit block ${block}, processing slot ${processedSlot}, deposit data root ${depositDataRoot}, slot of first pending deposit ${firstPendingDepositSlot} to beacon chain root ${beaconBlockRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .verifyDeposit(
      depositDataRoot,
      block,
      processedSlot,
      firstPendingDepositSlot,
      proof
    );
  await logTxDetails(tx, "verifyDeposit");
}

async function verifyBalances({ root, indexes, depositSlot, dryrun, signer }) {
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

  const oracle = await resolveContract("BeaconOracle");
  depositSlot = depositSlot || firstPendingDepositSlot;
  if (depositSlot > firstPendingDepositSlot)
    throw Error(
      "Deposit slot can not be greater than first pending deposit slot"
    );

  const isMapped = await oracle.isSlotMapped(depositSlot);
  if (!isMapped) {
    log(`Slot ${depositSlot} is not mapped in the Beacon Oracle`);
    // TODO need to check if depositSlot can be mapped
    await verifySlot({ slot: depositSlot });
    // TODO if it's too old, we find a block we have mapped that is before it.
  }

  log(
    `About verify ${verifiedValidators.length} validator balances for slot ${verificationSlot} to beacon block root ${beaconBlockRoot} with mapped deposit slot ${depositSlot}`
  );
  const tx = await strategy.connect(signer).verifyBalances({
    blockRoot: beaconBlockRoot,
    mappedDepositSlot: depositSlot,
    firstPendingDepositSlot,
    firstPendingDepositSlotProof,
    balancesContainerRoot,
    balancesContainerProof,
    validatorBalanceLeaves,
    validatorBalanceProofs,
  });
  await logTxDetails(tx, "verifyBalances");
}

async function blockToSlot({ block }) {
  const oracle = await resolveContract("BeaconOracle");

  const slot = await oracle.blockToSlot(block);

  console.log(`Block ${block} maps to slot ${slot}`);

  return slot;
}

async function slotToBlock({ slot }) {
  const oracle = await resolveContract("BeaconOracle");

  const block = await oracle.slotToBlock(slot);

  console.log(`Slot ${slot} maps to block ${block}`);

  return block;
}

async function slotToRoot({ slot }) {
  const oracle = await resolveContract("BeaconOracle");

  const root = await oracle.slotToRoot(slot);

  console.log(`Slot ${slot} maps to beacon block root ${root}`);

  return root;
}

async function beaconRoot({ block, live, signer }) {
  // Either use live chain or local fork to get the block timestamp
  const provider = live ? await getLiveProvider(signer) : signer.provider;

  // Get timestamp of the block
  const fetchedBlock = await provider.getBlock(block);
  if (fetchedBlock == null) throw Error(`Block ${block} not found`);

  const { timestamp } = fetchedBlock;
  log(`Block ${block} has timestamp ${timestamp}`);

  const data = defaultAbiCoder.encode(["uint256"], [timestamp]);
  log(`Encoded timestamp data: ${data}`);

  const root = await provider.call(
    {
      // The Beacon Roots contract is the same on mainnet and Hoodi
      to: addresses.mainnet.beaconRoots,
      data,
    },
    block // blockTag
  );

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
  for (let i = 0; i < stateView.pendingDeposits.length; i++) {
    const deposit = stateView.pendingDeposits.get(i);
    if (Buffer.from(deposit.pubkey).equals(validator.pubkey)) {
      console.log(`Found pending deposit at position ${i}`);
      console.log(`amount : ${formatUnits(deposit.amount, 9)}`);
      console.log(`slot   : ${deposit.slot}`);
      console.log(
        `withdrawal credentials : ${toHex(deposit.withdrawalCredentials)}`
      );
      // console.log(`signature ${toHex(deposit.signature)}`);
      depositsFound++;
    }
  }
  console.log(
    `${depositsFound} pending deposits found for validator in ${stateView.pendingDeposits.length} pending deposits`
  );

  let partialWithdrawalsFound = 0;
  for (let i = 0; i < stateView.pendingPartialWithdrawals.length; i++) {
    const withdrawal = stateView.pendingPartialWithdrawals.get(i);
    log(
      `Pending partial withdrawal for validator ${
        withdrawal.validatorIndex
      }, amount ${formatUnits(withdrawal.amount, 9)} and withdrawable epoch ${
        withdrawal.withdrawableEpoch
      }`
    );
    if (withdrawal.index == index) {
      console.log(`Found pending partial withdrawal at position ${i}`);
      console.log(`amount : ${formatUnits(withdrawal.amount, 9)}`);
      console.log(`withdrawable epoch : ${withdrawal.withdrawableEpoch}`);
      partialWithdrawalsFound++;
    }
  }
  console.log(
    `${partialWithdrawalsFound} pending partial withdrawals found for validator in ${stateView.pendingPartialWithdrawals.length} pending withdrawals`
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
    `${withdrawals} withdrawals found for validator in ${blockView.body.executionPayload.withdrawals.length} withdrawals`
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
  verifySlot,
  blockToSlot,
  slotToBlock,
  slotToRoot,
  beaconRoot,
  getValidator,
  verifyValidator,
  verifyDeposit,
  verifyBalances,
};
