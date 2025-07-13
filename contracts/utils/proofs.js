const { toHex } = require("../utils/units");
const { concatProof } = require("../utils/beacon");
const { formatUnits } = require("ethers/lib/utils");

const log = require("../utils/logger")("task:proof");

// BeaconBlock.slot
async function generateSlotProof({ blockView, blockTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const generalizedIndex = blockView.type.getPathInfo(["slot"]).gindex;
  log(`Generalized index for slot: ${generalizedIndex}`);

  log(`Generating slot proof to beacon block root`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`Slot leaf: ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  log(`Slot proof in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    leaf: toHex(proofObj.leaf),
    slot: blockView.slot,
  };
}

// BeaconBlock.body.executionPayload.blockNumber
async function generateBlockProof({ blockView, blockTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  log(`Block number: ${blockView.body.executionPayload.blockNumber}`);

  const generalizedIndex = blockView.type.getPathInfo([
    "body",
    "executionPayload",
    "blockNumber",
  ]).gindex;
  log(`Generalized index for block number: ${generalizedIndex}`);

  log(`Generating block number proof to beacon block root`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });

  log(`Block number leaf: ${toHex(proofObj.leaf)}`);

  const proofBytes = toHex(concatProof(proofObj));
  log(`Block number proof in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    leaf: toHex(proofObj.leaf),
    blockNumber: blockView.body.executionPayload.blockNumber,
  };
}

// BeaconBlock.state.PendingDeposits[0].slot
async function generateFirstPendingDepositSlotProof({
  blockView,
  blockTree,
  stateView,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const generalizedIndex = concatGindices([
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
    toGindex(3, 4n), // depth 3, index 4 for slot = 11
  ]);
  log(
    `gen index for the slot in the first pending deposit in the beacon block: ${generalizedIndex}`
  );
  const firstPendingDeposit = stateView.pendingDeposits.get(0);
  log(`slot of the first pending deposit ${firstPendingDeposit.slot}`);

  log(`Generating proof for the slot of the first pending deposit`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  const proofBytes = toHex(concatProof(proofObj));
  log(`First deposit slot proof in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    leaf: toHex(proofObj.leaf),
    slot: firstPendingDeposit.slot,
    firstPendingDeposit,
  };
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
  log(`Public key proof in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    leaf: toHex(proofObj.leaf),
    pubKey: validatorDetails.pubkey,
  };
}

// BeaconBlock.state.balances
async function generateBalancesContainerProof({
  blockView,
  blockTree,
  stateView,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const generalizedIndex = concatGindices([
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["balances"]).gindex,
  ]);
  log(`gen index for balances container in beacon block: ${generalizedIndex}`);

  log(`Generating balances container proof`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`Balances container leaf: ${toHex(proofObj.leaf)}`);

  const proofBytes = toHex(concatProof(proofObj));
  log(`Balances container proof in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
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
  log(`Validator ${validatorIndex} balance: ${formatUnits(validatorBalance)}`);

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
  log(
    `Validator ${validatorIndex} balance proof in Balances container in bytes:\n${proofBytes}`
  );

  return {
    proof: proofBytes,
    generalizedIndex: genIndexBalancesContainer,
    root: toHex(balancesTree.root),
    leaf: toHex(proofObj.leaf),
    balance: validatorBalance,
  };
}

module.exports = {
  generateSlotProof,
  generateBlockProof,
  generateFirstPendingDepositSlotProof,
  generateValidatorPubKeyProof,
  generateBalancesContainerProof,
  generateBalanceProof,
};
