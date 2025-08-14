const { toHex } = require("../utils/units");
const { concatProof, hashPubKey, getValidator } = require("../utils/beacon");
const { formatUnits } = require("ethers/lib/utils");

const log = require("../utils/logger")("task:proof");

// BeaconBlock.state
async function generateStateProof({ blockView, blockTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const generalizedIndex = blockView.type.getPathInfo(["stateRoot"]).gindex;
  log(`gen index for state in beacon block: ${generalizedIndex}`);

  log(`Generating state proof`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`State root leaf (hash): ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  const depth = proofObj.witnesses.length;
  log(`State proof of depth ${depth} in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
  };
}

// BeaconBlock.state.PendingDeposits[0].slot
async function generateFirstPendingDepositProofs({ stateView, stateTree }) {
  const returnObject = {
    stateRoot: toHex(stateTree.root),
    isEmpty: false,
  };

  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  // Default to an empty deposit queue
  const firstPendingDeposit = {
    slot: 0,
    pubKeyHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    slotProof: "",
    pubKeyProof: "",
  };
  returnObject.firstPendingDeposit = firstPendingDeposit;

  // Proof for State.pendingDeposits[0]
  const firstPendingDepositGenIndex = stateView.type.getPathInfo([
    "pendingDeposits",
    0,
  ]).gindex;
  log(
    `Generating proof for the the first pending deposit to the state root using generalized index ${firstPendingDepositGenIndex}`
  );
  const firstPendingDepositProofObj = createProof(stateTree.rootNode, {
    type: ProofType.single,
    gindex: firstPendingDepositGenIndex,
  });
  firstPendingDeposit.root = toHex(firstPendingDepositProofObj.leaf);
  log(`First pending deposit root: ${firstPendingDeposit.root}`);
  firstPendingDeposit.containerProof = toHex(
    concatProof(firstPendingDepositProofObj)
  );
  log(
    `First deposit to state proof of depth ${firstPendingDepositProofObj.witnesses.length} in bytes:\n${firstPendingDeposit.containerProof}`
  );

  if (stateView.pendingDeposits.length == 0) {
    log("No deposits in the deposit queue");
    returnObject.isEmpty = true;
    return returnObject;
  }
  log(`There are ${stateView.pendingDeposits.length} pending deposits`);

  const firstPendingDepositData = stateView.pendingDeposits.get(0);
  log(
    `First pending deposit slot ${
      firstPendingDepositData.slot
    }, withdrawal credential ${toHex(
      firstPendingDepositData.withdrawalCredentials
    )} and public key ${toHex(firstPendingDepositData.pubkey)}`
  );
  firstPendingDeposit.slot = firstPendingDepositData.slot;
  firstPendingDeposit.pubKey = toHex(firstPendingDepositData.pubkey);
  firstPendingDeposit.pubKeyHash = hashPubKey(firstPendingDepositData.pubkey);

  const firstPendingDepositTree = stateTree.getSubtree(
    firstPendingDepositGenIndex
  );

  // Proof for PendingDeposit.slot
  // PendingDeposit height 3, slot at index 4
  const pendingDepositSlotGenIndex = toGindex(3, 4n);
  log(
    `Generating proof for the slot of the first pending deposit using generalized index ${pendingDepositSlotGenIndex}`
  );
  const pendingDepositSlotObj = createProof(firstPendingDepositTree.rootNode, {
    type: ProofType.single,
    gindex: pendingDepositSlotGenIndex,
  });
  log(`First deposit slot leaf: ${toHex(pendingDepositSlotObj.leaf)}`);
  firstPendingDeposit.slotProof = toHex(concatProof(pendingDepositSlotObj));
  log(
    `Slot to first deposit proof of depth ${pendingDepositSlotObj.witnesses.length} in bytes:\n${firstPendingDeposit.slotProof}`
  );

  // Proof for PendingDeposit.pubkey
  // PendingDeposit height 3, pubkey at index 0
  const pendingDepositPubKeyGenIndex = toGindex(3, 0n);
  log(
    `Generating proof for the pubkey of the first pending deposit using generalized index ${pendingDepositPubKeyGenIndex}`
  );
  const pendingDepositPubKeyObj = createProof(
    firstPendingDepositTree.rootNode,
    {
      type: ProofType.single,
      gindex: pendingDepositPubKeyGenIndex,
    }
  );
  log(`First deposit pubkey leaf: ${toHex(pendingDepositPubKeyObj.leaf)}`);
  firstPendingDeposit.pubKeyProof = toHex(concatProof(pendingDepositPubKeyObj));
  log(
    `Pubkey to first deposit proof of depth ${pendingDepositPubKeyObj.witnesses.length} in bytes:\n${firstPendingDeposit.pubKeyProof}`
  );

  console.log(
    `First pending deposit is to validator with pubkey ${firstPendingDeposit.pubKey}`
  );

  // Get validator details using the pubkey
  const validator = await getValidator(firstPendingDeposit.pubKey);
  log(
    `The first pending deposit is for a validator with index ${validator.validatorindex}, status ${validator.status}, exit epoch ${validator.exitepoch}`
  );

  const firstPendingDepositValidator = {
    pubKeyHash: firstPendingDepositData.pubKeyHash,
    index: validator.validatorindex,
    pubKeyProof: "",
    exitProof: "",
    // The root and containerProof are set next
  };
  returnObject.firstPendingDepositValidator = firstPendingDepositValidator;

  // Proof for State.validators[validatorIndex]
  const validatorContainerGenIndex = stateView.type.getPathInfo([
    "validators",
    firstPendingDepositValidator.index,
  ]).gindex;
  log(
    `Generating proof for the the validator container at index ${firstPendingDepositValidator.index} to the state root using generalized index ${validatorContainerGenIndex}`
  );
  const validatorContainerProofObj = createProof(stateTree.rootNode, {
    type: ProofType.single,
    gindex: validatorContainerGenIndex,
  });
  firstPendingDepositValidator.root = toHex(validatorContainerProofObj.leaf);
  log(`Validator container root: ${firstPendingDepositValidator.root}`);
  firstPendingDepositValidator.containerProof = toHex(
    concatProof(validatorContainerProofObj)
  );
  log(
    `Validator container to state proof of depth ${validatorContainerProofObj.witnesses.length} in bytes:\n${firstPendingDepositValidator.containerProof}`
  );

  // If the deposit is to a new validator so no need to verify if it is exiting.
  if (
    firstPendingDepositValidator.root ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return returnObject;
  }

  const validatorTree = stateTree.getSubtree(validatorContainerGenIndex);
  log(validatorTree);

  // Proof for Validator.pubkey
  // Validator height 3, pubkey at index 0
  const validatorPubKeyGenIndex = toGindex(3, 0n);
  log(
    `Generating proof for the pubkey of the validator using generalized index ${validatorPubKeyGenIndex}`
  );
  const validatorPubKeyObj = createProof(validatorTree.rootNode, {
    type: ProofType.single,
    gindex: validatorPubKeyGenIndex,
  });
  log(`Validator pubkey leaf: ${toHex(validatorPubKeyObj.leaf)}`);
  firstPendingDepositValidator.pubKeyProof = toHex(
    concatProof(pendingDepositPubKeyObj)
  );
  log(
    `Pubkey to validator root proof of depth ${validatorPubKeyObj.witnesses.length} in bytes:\n${firstPendingDepositValidator.pubKeyProof}`
  );

  // Proof for Validator.exitProof
  // Validator height 3, exit epoch at index 6
  const validatorExitEpochGenIndex = toGindex(3, 6n);
  log(
    `Generating proof for the exit epoch of the validator using generalized index ${validatorExitEpochGenIndex}`
  );
  const validatorExitEpochObj = createProof(validatorTree.rootNode, {
    type: ProofType.single,
    gindex: validatorExitEpochGenIndex,
  });
  log(`Validator exit epoch leaf: ${toHex(validatorExitEpochObj.leaf)}`);
  firstPendingDepositValidator.exitProof = toHex(
    concatProof(validatorExitEpochObj)
  );
  log(
    `Exit epoch to validator root proof of depth ${validatorExitEpochObj.witnesses.length} in bytes:\n${firstPendingDepositValidator.exitProof}`
  );

  return returnObject;
}

// BeaconBlock.state.validators[validatorIndex].pubkey
async function generateValidatorPubKeyProof({
  validatorIndex,
  blockView,
  blockTree,
  stateView,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const validatorDetails = stateView.validators.get(validatorIndex);
  log(
    `Validator public key for validator ${validatorIndex}: ${toHex(
      validatorDetails.pubkey
    )}`
  );

  const generalizedIndex = concatGindices([
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["validators", validatorIndex]).gindex,
    toGindex(3, 0n), // depth 3, index 0 for pubkey = 8
  ]);
  log(
    `gen index for pubkey of validator ${validatorIndex} in beacon block: ${generalizedIndex}`
  );

  log(`Generating validator pubkey proof`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`Validator public key leaf (hash): ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  const depth = proofObj.witnesses.length;
  log(`Public key proof of depth ${depth} in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
    pubKey: toHex(validatorDetails.pubkey),
  };
}

// State.balances
async function generateBalancesContainerProof({ stateView, stateTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const generalizedIndex = stateView.type.getPathInfo(["balances"]).gindex;
  log(`Gen index for balances container in beacon block: ${generalizedIndex}`);

  log(`Generating balances container proof`);
  const proofObj = createProof(stateTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`Balances container leaf: ${toHex(proofObj.leaf)}`);

  const proofBytes = toHex(concatProof(proofObj));
  log(
    `Balances container proof of depth ${proofObj.witnesses.length} in bytes:\n${proofBytes}`
  );

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(stateTree.root),
    leaf: toHex(proofObj.leaf),
  };
}

// BeaconBlock.state.balances[validatorIndex]
// Generates a proof in the Balances container rather than the whole beacon block
async function generateBalanceProof({
  blockView,
  blockTree,
  stateView,
  validatorIndex,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  // Read the validator's balance from the state
  const validatorBalance = stateView.balances.get(validatorIndex);
  log(
    `Validator ${validatorIndex} balance: ${formatUnits(validatorBalance, 9)}`
  );

  // BeaconBlock.state.balances
  const genIndexBalancesContainer = concatGindices([
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["balances"]).gindex,
  ]);
  log(
    `gen index for balances container in beacon block: ${genIndexBalancesContainer}`
  );
  const balancesTree = blockTree.getSubtree(genIndexBalancesContainer);

  // BeaconBlock.state.balances[validatorIndex]
  // There are 4 balances per leaf, so we need to divide by 4 which is right shift by 2.
  const balanceIndex = validatorIndex >> 2;
  log(`Balance index in the balances container: ${balanceIndex}`);
  const genIndexBalanceContainer = toGindex(
    stateView.balances.type.depth,
    BigInt(balanceIndex)
  );
  log(`index for balance in balances container: ${genIndexBalanceContainer}`);

  log(`Balances sub tree root: ${toHex(balancesTree.root)}`);

  log(`Generating balance in balances container proof`);
  const proofObj = createProof(balancesTree.rootNode, {
    type: ProofType.single,
    gindex: genIndexBalanceContainer,
  });
  log(`Balances container leaf: ${toHex(proofObj.leaf)}`);

  const proofBytes = toHex(concatProof(proofObj));
  const depth = proofObj.witnesses.length;
  log(
    `Validator ${validatorIndex} balance proof of depth ${depth} in Balances container in bytes:\n${proofBytes}`
  );

  return {
    proof: proofBytes,
    generalizedIndex: genIndexBalancesContainer,
    root: toHex(balancesTree.root),
    leaf: toHex(proofObj.leaf),
    depth,
    balance: validatorBalance,
  };
}

module.exports = {
  generateStateProof,
  generateFirstPendingDepositProofs,
  generateValidatorPubKeyProof,
  generateBalancesContainerProof,
  generateBalanceProof,
};
