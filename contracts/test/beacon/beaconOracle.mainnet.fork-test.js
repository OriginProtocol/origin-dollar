const { expect } = require("chai");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { toHex } = require("../../utils/units");
const {
  concatProof,
  getBeaconBlock,
  getCurrentSlot,
} = require("../../utils/beacon");
const { before } = require("mocha");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Oracle", function () {
  this.timeout(0);

  let remoteProvider;
  let blockView, blockTree;
  let pastSlot;
  let pastBlockNumber;
  let nextBlock;
  before(async () => {
    // Getting provider to chain before the fork
    remoteProvider = new ethers.providers.JsonRpcProvider(
      process.env.PROVIDER_URL
    );
  });
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    const currentSlot = await getCurrentSlot();

    // Needs to be old enough so its before the local fork
    // But not too old that its before the beacon root oracle ring buffer
    pastSlot = Math.floor((currentSlot - 1000) / 1000) * 1000;

    ({ blockView, blockTree } = await getBeaconBlock(pastSlot));

    log(`Beacon block root: ${toHex(blockView.hashTreeRoot())}`);
    pastBlockNumber = blockView.body.executionPayload.blockNumber;
    log(`Beacon block number: ${pastBlockNumber}`);
    const nextBlockNumber = pastBlockNumber + 1;
    log(`Next block number  : ${nextBlockNumber}`);

    nextBlock = await remoteProvider.getBlock(nextBlockNumber);
    if (nextBlock === null)
      throw Error(`Failed to get next block ${nextBlockNumber}`);
  });

  it("verify a block to a slot", async () => {
    const { beaconOracle } = fixture;

    const { createProof, ProofType } = await import(
      "@chainsafe/persistent-merkle-tree"
    );

    // BeaconBlock.slot
    const slotGenIndex = blockView.type.getPathInfo(["slot"]).gindex;
    log(`Slot gindex: ${slotGenIndex}`);
    const slotProof = createProof(blockTree.rootNode, {
      type: ProofType.single,
      gindex: slotGenIndex,
    });
    const slotProofBytes = concatProof(slotProof);
    log(`Slot proof: ${toHex(slotProofBytes)}`);

    // BeaconBlock.body.executionPayload.blockNumber
    const blockNumberGenIndex = blockView.type.getPathInfo([
      "body",
      "executionPayload",
      "blockNumber",
    ]).gindex;
    const blockNumberProof = createProof(blockTree.rootNode, {
      type: ProofType.single,
      gindex: blockNumberGenIndex,
    });
    const blockNumberProofBytes = concatProof(blockNumberProof);
    log(`Block number proof in bytes:\n${toHex(blockNumberProofBytes)}`);

    const parentTimestamp = nextBlock.timestamp;
    log(
      `Parent block timestamp ${parentTimestamp} for block ${nextBlock.number}`
    );

    log(`About to submit slot and block proofs`);
    await beaconOracle.proveSlot(
      parentTimestamp,
      pastBlockNumber,
      pastSlot,
      slotProofBytes,
      blockNumberProofBytes
    );

    log(`Proofs have been verified`);

    expect(await beaconOracle.blockToSlot(pastBlockNumber)).to.equal(pastSlot);
    expect(await beaconOracle.slotToBlock(pastSlot)).to.equal(pastBlockNumber);

    await expect(
      beaconOracle.proveSlot(
        parentTimestamp,
        pastBlockNumber,
        pastSlot,
        slotProofBytes,
        blockNumberProofBytes
      )
    ).to.revertedWith("Block already mapped");
  });
});
