const { toHex } = require("../utils/units");
const { concatProof, hashPubKey, getValidator } = require("../utils/beacon");
const { formatUnits } = require("ethers/lib/utils");
const { MAX_UINT64, ZERO_BYTES32 } = require("./constants");

const log = require("../utils/logger")("task:proof");

// BeaconBlock.state.PendingDeposits[0].pubkey
async function generateFirstPendingDepositPubKeyProof({
  blockView,
  blockTree,
  stateView,
  test,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  log(`There are ${stateView.pendingDeposits.length} pending deposits`);
  const generalizedIndex =
    stateView.pendingDeposits.length > 0
      ? concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
          toGindex(3, 0n), // depth 3, index 0 for pubKey = 8
        ])
      : concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
        ]);
  log(
    `Generalized index for the pubkey of the first pending deposit or the root node of the first pending deposit in the beacon block: ${generalizedIndex}`
  );
  let firstPendingDepositSlot = 0;
  let firstPendingDepositPubKey = "0x";
  let firstPendingDepositPubKeyHash = ZERO_BYTES32;
  let firstPendingDepositValidatorIndex = 0;
  if (stateView.pendingDeposits.length == 0) {
    log("No deposits in the deposit queue");
  } else {
    const firstPendingDeposit = stateView.pendingDeposits.get(0);
    firstPendingDepositSlot = firstPendingDeposit.slot;
    firstPendingDepositPubKey = toHex(firstPendingDeposit.pubkey);
    firstPendingDepositPubKeyHash = hashPubKey(firstPendingDeposit.pubkey);
    firstPendingDepositValidatorIndex = firstPendingDeposit.validatorIndex;
    log(
      `First pending deposit has slot ${
        firstPendingDeposit.slot
      }, withdrawal credential ${toHex(
        firstPendingDeposit.withdrawalCredentials
      )} and public key ${firstPendingDepositPubKey}`
    );

    const firstDepositValidator = await getValidator(firstPendingDepositPubKey);
    firstPendingDepositValidatorIndex = firstDepositValidator.validatorindex;
    log(
      `First pending deposit validator index: ${firstPendingDepositValidatorIndex}`
    );
  }

  log(
    `Generating proof for the the first pending deposit to beacon block root ${toHex(
      blockTree.root
    )}`
  );
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`First pending deposit pub key leaf: ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  log(
    `First pending deposit pub key proof of depth ${proofObj.witnesses.length} in bytes:\n${proofBytes}`
  );

  if (test) {
    // Generate the proof of the slot within the first pending deposit
    const subTreeGeneralizedIndex = concatGindices([
      blockView.type.getPathInfo(["stateRoot"]).gindex,
      stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
      toGindex(1, 1n), // depth 1, index 1 for slot = 3
    ]);
    // Generate the slot proof in the first pending deposit
    const subTree = blockTree.getSubtree(subTreeGeneralizedIndex);
    log(`Sub tree root: ${toHex(subTree.root)}`);
    const subTreeProofObj = createProof(subTree.rootNode, {
      type: ProofType.single,
      // depth 2, index 0 for slot = 4
      gindex: toGindex(2, 0n),
    });
    log(
      `First pending deposit slot ${firstPendingDepositSlot} has leaf: ${toHex(
        subTreeProofObj.leaf
      )}`
    );
    const subTreeProofBytes = toHex(concatProof(subTreeProofObj));
    log(
      `First pending deposit slot proof of depth ${subTreeProofObj.witnesses.length} in bytes:\n${subTreeProofBytes}`
    );
  }

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
    slot: firstPendingDepositSlot,
    pubkeyHash: firstPendingDepositPubKeyHash,
    validatorIndex: firstPendingDepositValidatorIndex,
    isEmpty: stateView.pendingDeposits.length === 0,
  };
}

// BeaconBlock.state.PendingDeposits[0].slot
async function generateFirstPendingDepositSlotProof({
  blockView,
  blockTree,
  stateView,
  test,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  log(`There are ${stateView.pendingDeposits.length} pending deposits`);
  const generalizedIndex =
    stateView.pendingDeposits.length > 0
      ? concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
          toGindex(3, 4n), // depth 3, index 4 for slot = 12
        ])
      : concatGindices([
          blockView.type.getPathInfo(["stateRoot"]).gindex,
          stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
        ]);
  log(
    `Generalized index for the slot of the first pending deposit or the root node of the first pending deposit in the beacon block: ${generalizedIndex}`
  );
  let firstPendingDepositSlot = 0;
  let firstPendingDepositPubKey = "0x";
  let firstPendingDepositValidatorIndex = 0;
  if (stateView.pendingDeposits.length == 0) {
    log("No deposits in the deposit queue");
  } else {
    const firstPendingDeposit = stateView.pendingDeposits.get(0);
    firstPendingDepositSlot = firstPendingDeposit.slot;
    firstPendingDepositPubKey = toHex(firstPendingDeposit.pubkey);
    firstPendingDepositValidatorIndex = firstPendingDeposit.validatorIndex;
    log(
      `First pending deposit has slot ${
        firstPendingDeposit.slot
      }, withdrawal credential ${toHex(
        firstPendingDeposit.withdrawalCredentials
      )} and public key ${firstPendingDepositPubKey}`
    );

    const firstDepositValidator = await getValidator(firstPendingDepositPubKey);
    firstPendingDepositValidatorIndex = firstDepositValidator.validatorindex;
    log(
      `First pending deposit validator index: ${firstPendingDepositValidatorIndex}`
    );
  }

  log(
    `Generating proof for the the first pending deposit slot to beacon block root ${toHex(
      blockTree.root
    )}`
  );
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndex,
  });
  log(`First pending deposit slot leaf: ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  log(
    `First pending deposit slot proof of depth ${proofObj.witnesses.length} in bytes:\n${proofBytes}`
  );

  if (test) {
    // Generate the proof of the slot within the first pending deposit
    const subTreeGeneralizedIndex = concatGindices([
      blockView.type.getPathInfo(["stateRoot"]).gindex,
      stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
      toGindex(1, 1n), // depth 1, index 1 for slot = 3
    ]);
    // Generate the slot proof in the first pending deposit
    const subTree = blockTree.getSubtree(subTreeGeneralizedIndex);
    log(`Sub tree root: ${toHex(subTree.root)}`);
    const subTreeProofObj = createProof(subTree.rootNode, {
      type: ProofType.single,
      // depth 2, index 0 for slot = 4
      gindex: toGindex(2, 0n),
    });
    log(
      `First pending deposit slot ${firstPendingDepositSlot} has leaf: ${toHex(
        subTreeProofObj.leaf
      )}`
    );
    const subTreeProofBytes = toHex(concatProof(subTreeProofObj));
    log(
      `First pending deposit slot proof of depth ${subTreeProofObj.witnesses.length} in bytes:\n${subTreeProofBytes}`
    );
  }

  return {
    proof: proofBytes,
    generalizedIndex,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
    slot: firstPendingDepositSlot,
    isEmpty: stateView.pendingDeposits.length === 0,
  };
}

async function generateValidatorWithdrawableEpochProof({
  blockView,
  blockTree,
  stateView,
  validatorIndex,
  includePubKeyProof,
}) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { concatGindices, createProof, ProofType, toGindex } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  const validator = stateView.validators.get(validatorIndex);
  if (
    !validator ||
    toHex(validator.node.root) ==
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    throw new Error(
      `Validator with index ${validatorIndex} not found in the state at slot ${blockView.slot}.`
    );
  }
  const withdrawableEpoch =
    validator.withdrawableEpoch == Infinity
      ? MAX_UINT64
      : validator.withdrawableEpoch;
  log(
    `Validator ${validatorIndex} has withdrawable epoch ${withdrawableEpoch} and public key ${toHex(
      validator.pubkey
    )}`
  );
  log(`${stateView.validators.length} validators at slot ${blockView.slot}.`);

  const generalizedIndexValidatorContainer = concatGindices([
    // 715n,
    // (2n ^ 41n) + BigInt(validatorIndex),
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["validators", validatorIndex]).gindex,
  ]);
  const generalizedIndexWithdrawableEpoch = concatGindices([
    generalizedIndexValidatorContainer,
    toGindex(3, 7n), // depth 3, withdrawableEpoch index 7 = 2 ^ 3 + 7 = 15
  ]);

  log(
    `Gen index for withdrawableEpoch of validator ${validatorIndex} in beacon block: ${generalizedIndexWithdrawableEpoch}`
  );

  log(
    `Generating validator withdrawableEpoch proof to beacon block root ${toHex(
      blockTree.root
    )}`
  );
  const proofObj = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: generalizedIndexWithdrawableEpoch,
  });
  log(`Validator withdrawableEpoch leaf (hash): ${toHex(proofObj.leaf)}`);
  const proofBytes = toHex(concatProof(proofObj));
  const depth = proofObj.witnesses.length;
  log(`Withdrawable epoch proof of depth ${depth} in bytes:\n${proofBytes}`);

  if (!includePubKeyProof) {
    return {
      proof: proofBytes,
      generalizedIndexWithdrawableEpoch,
      root: toHex(blockTree.root),
      leaf: toHex(proofObj.leaf),
      withdrawableEpoch,
    };
  }

  const generalizedIndexSubTreeRoot = concatGindices([
    generalizedIndexValidatorContainer,
    toGindex(1, 0n), // depth 1, index 0 = 2 ^ 1 + 0 = 2
  ]);
  const subTree = blockTree.getSubtree(generalizedIndexSubTreeRoot);

  log(
    `Generating validator pubkey proof to sub tree root ${toHex(subTree.root)}`
  );
  const pubKeySubProofObj = createProof(subTree.rootNode, {
    type: ProofType.single,
    gindex: 4, // depth 2, index 0 = 2 ^ 2 + 0 = 4
  });

  log(
    `Validator public key hash leaf (hash): ${toHex(pubKeySubProofObj.leaf)}`
  );
  const pubKeySubTreeProofBytes = toHex(concatProof(pubKeySubProofObj));
  log(
    `Pub key sub tree proof of depth ${pubKeySubProofObj.witnesses.length} in bytes:\n${pubKeySubTreeProofBytes}`
  );

  return {
    proof: proofBytes,
    generalizedIndex: generalizedIndexWithdrawableEpoch,
    root: toHex(blockTree.root),
    leaf: toHex(proofObj.leaf),
    withdrawableEpoch,
    validatorPubKeyProof: pubKeySubTreeProofBytes,
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
  if (
    !validatorDetails ||
    toHex(validatorDetails.node.root) ==
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    throw new Error(
      `Validator with index ${validatorIndex} not found in the state at slot ${blockView.slot}.`
    );
  }
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

  log(
    `Generating validator pubkey proof to beacon block root ${toHex(
      blockTree.root
    )}`
  );
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

  log(
    `Generating balances container proof to beacon block root ${toHex(
      blockTree.root
    )}`
  );
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

  log(
    `Generating balance in balances container proof to balances container root ${toHex(
      balancesTree.root
    )}`
  );
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
  generateFirstPendingDepositPubKeyProof,
  generateFirstPendingDepositSlotProof,
  generateValidatorWithdrawableEpochProof,
  generateValidatorPubKeyProof,
  generateBalancesContainerProof,
  generateBalanceProof,
};
