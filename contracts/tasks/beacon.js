const { getBeaconBlock, getSlot } = require("../utils/beacon");
const { getSigner } = require("../utils/signers");
const { toHex } = require("../utils/units");
const { concatProof } = require("../utils/beacon");
const { resolveContract } = require("../utils/resolvers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:beacon");

async function verifySlot({ block }) {
  const signer = await getSigner();

  // Get provider to mainnet and not a local fork
  const provider = getProvider();

  // Get the timestamp of the next block
  const nextBlock = block + 1;
  const { timestamp: nextBlockTimestamp } = await provider.getBlock(nextBlock);
  log(`next block ${nextBlock} has timestamp ${nextBlockTimestamp}`);

  // Get the parent block root from the beacon roots contract
  const mockBeaconRoots = await ethers.getContract("MockBeaconRoots");
  const parentBlockRoot = await mockBeaconRoots.parentBlockRoot(
    nextBlockTimestamp
  );
  log(`Parent block root for block ${nextBlock} is ${parentBlockRoot}`);

  const slot = await getSlot(parentBlockRoot);
  log(`Slot for block ${block} is:`, slot);

  const { blockView, blockTree } = await getBeaconBlock(slot);

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

  const oracle = await resolveContract("BeaconOracle");

  log(`About map ${block} to ${slot}`);
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

function getProvider() {
  // Get provider to Ethereum mainnet and not a local fork
  return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
}

module.exports = {
  verifySlot,
};
