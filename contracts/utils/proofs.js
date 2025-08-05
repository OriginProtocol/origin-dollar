const { toHex } = require("../utils/units");
const { concatProof } = require("../utils/beacon");
const { formatUnits } = require("ethers/lib/utils");

const log = require("../utils/logger")("task:proof");

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

  const generalizedIndex =
    stateView.pendingDeposits.length > 0
      ? concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
          toGindex(3, 4n), // depth 3, index 4 for slot = 11
        ])
      : concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
        ]);
  log(
    `Generalized index for the slot in the slot of the first pending deposit in the beacon block: ${generalizedIndex}`
  );
  let firstPendingDepositSlot = 0;
  if (stateView.pendingDeposits.length == 0) {
    log("No deposits in the deposit queue");
  } else {
    const firstPendingDeposit = stateView.pendingDeposits.get(0);
    firstPendingDepositSlot = firstPendingDeposit.slot;
    log(`Slot of the first pending deposit ${firstPendingDepositSlot}`);
  }

  log(`Generating proof for the slot of the first pending deposit`);
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`First deposit slot leaf: ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  const depth = proofObj.witnesses.length;
  log(`First deposit slot proof of depth ${depth} in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
    slot: firstPendingDepositSlot,
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
  const depth = proofObj.witnesses.length;
  log(`Balances container proof of depth ${depth} in bytes:\n${proofBytes}`);

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
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
  generateFirstPendingDepositSlotProof,
  generateValidatorPubKeyProof,
  generateBalancesContainerProof,
  generateBalanceProof,
};
