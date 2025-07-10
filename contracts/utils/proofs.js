const { toHex } = require("../utils/units");
const { concatProof } = require("../utils/beacon");

const log = require("../utils/logger")("task:proof");

// BeaconBlock.slot
async function generateSlotProof({ blockView, blockTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  // BeaconBlock.slot
  log(`Generating slot proof to beacon block root`);
  const slotGenIndex = blockView.type.getPathInfo(["slot"]).gindex;
  const slotProof = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: slotGenIndex,
  });
  log(`Slot leaf: ${toHex(slotProof.leaf)}`);
  // console.log(
  //   `Proof of slot to block root ${
  //     slotProof.witnesses.length
  //   }: ${slotProof.witnesses.map(toHex)}`
  // );
  const slotProofBytes = toHex(concatProof(slotProof));
  log(`Slot proof in bytes:\n${slotProofBytes}`);

  return slotProofBytes;
}

// BeaconBlock.body.executionPayload.blockNumber
async function generateBlockProof({ blockView, blockTree }) {
  // Have to dynamically import the Lodestar API client as its an ESM module
  const { createProof, ProofType } = await import(
    "@chainsafe/persistent-merkle-tree"
  );

  // BeaconBlock.body.executionPayload.blockNumber
  log(`Generating block number proof to beacon block root`);
  const blockNumberGenIndex = blockView.type.getPathInfo([
    "body",
    "executionPayload",
    "blockNumber",
  ]).gindex;
  log(`Generalized index for block number: ${blockNumberGenIndex}`);
  log(`Block number: ${blockView.body.executionPayload.blockNumber}`);
  const blockNumberProof = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: blockNumberGenIndex,
  });
  log(`Block number leaf: ${toHex(blockNumberProof.leaf)}`);
  // log(
  //   `Proof of block number to block root ${
  //     blockNumberProof.witnesses.length
  //   }: ${blockNumberProof.witnesses.map(toHex)}`
  // );
  const blockNumberProofBytes = toHex(concatProof(blockNumberProof));
  log(`Block number proof in bytes:\n${blockNumberProofBytes}`);

  return blockNumberProofBytes;
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

  // BeaconBlock.state.PendingDeposits[0].slot
  console.log(`\nGenerating proof for the slot of the first pending deposit`);
  const genIndex = concatGindices([
    blockView.type.getPathInfo(["stateRoot"]).gindex,
    stateView.type.getPathInfo(["pendingDeposits", 0]).gindex,
    toGindex(3, 4n), // depth 3, index 4 for slot = 11
  ]);
  console.log(
    `gen index for the slot in the first pending deposit in the beacon block: ${genIndex}`
  );
  const firstPendingDeposit = stateView.pendingDeposits.get(0);
  console.log(`slot of the first pending deposit ${firstPendingDeposit.slot}`);
  const firstDepositSlotProof = createProof(blockTree.rootNode, {
    type: ProofType.single,
    gindex: genIndex,
  });
  const firstDepositSlotProofBytes = toHex(concatProof(firstDepositSlotProof));
  log(`First deposit slot proof in bytes:\n${firstDepositSlotProofBytes}`);

  return { proof: firstDepositSlotProofBytes, slot: firstPendingDeposit.slot };
}

module.exports = {
  generateSlotProof,
  generateBlockProof,
  generateFirstPendingDepositSlotProof,
};
