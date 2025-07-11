const { expect } = require("chai");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { toHex } = require("../../utils/units");
const { concatProof, getBeaconBlock, getSlot } = require("../../utils/beacon");
const { before } = require("mocha");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Proofs", function () {
  this.timeout(0);

  let remoteProvider;
  let blockView, blockTree;
  let pastSlot;
  before(async () => {
    // Getting provider to chain before the fork
    remoteProvider = new ethers.providers.JsonRpcProvider(
      process.env.PROVIDER_URL
    );

    const currentSlot = await getSlot();

    // Needs to be old enough so its before the local fork
    // But not too old that its before the beacon root oracle ring buffer
    pastSlot = Math.floor((currentSlot - 1000) / 1000) * 1000;

    ({ blockView, blockTree } = await getBeaconBlock(pastSlot));
  });
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should verify a block to a slot", async () => {
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
    log(`Block number gindex: ${blockNumberGenIndex}`);
    const blockNumberProofBytes = concatProof(blockNumberProof);
    log(`Block number proof in bytes:\n${toHex(blockNumberProofBytes)}`);

    log(`Beacon block root: ${toHex(blockView.hashTreeRoot())}`);

    const pastBlockNumber = blockView.body.executionPayload.blockNumber;
    log(`Beacon block number: ${pastBlockNumber}`);

    const nextBlockNumber = pastBlockNumber + 1;
    const nextBlock = await remoteProvider.getBlock(nextBlockNumber);
    const parentTimestamp = nextBlock.timestamp;
    log(
      `Parent block timestamp ${parentTimestamp} for next block ${nextBlock.number}`
    );

    log(`About to submit slot and block proofs`);
    const tx = await beaconOracle.verifySlot(
      parentTimestamp,
      pastBlockNumber,
      pastSlot,
      slotProofBytes,
      blockNumberProofBytes
    );
    await expect(tx)
      .to.emit(beaconOracle, "BlockToSlot")
      .withArgs(toHex(blockView.hashTreeRoot()), pastBlockNumber, pastSlot);

    log(`Proofs have been verified`);

    expect(await beaconOracle.blockToSlot(pastBlockNumber)).to.equal(pastSlot);
    expect(await beaconOracle.slotToBlock(pastSlot)).to.equal(pastBlockNumber);

    await expect(
      beaconOracle.verifySlot(
        parentTimestamp,
        pastBlockNumber,
        pastSlot,
        slotProofBytes,
        blockNumberProofBytes
      )
    ).to.revertedWith("Block already mapped");
  });
  it("Fail to verify a block using timestamp from the same block", async () => {
    // This will use the beacon block root of the previous block hence the verification of the proofs will fail.
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

    const pastBlockNumber = blockView.body.executionPayload.blockNumber;
    const pastBlock = await remoteProvider.getBlock(pastBlockNumber);

    await expect(
      beaconOracle.verifySlot(
        pastBlock.timestamp,
        pastBlockNumber,
        pastSlot,
        slotProofBytes,
        blockNumberProofBytes
      )
    ).to.revertedWith("Invalid slot number proof");
  });
  it("Fail to get unmapped slot", async () => {
    const { beaconOracle } = fixture;

    await expect(beaconOracle.slotToBlock(12035387)).to.be.revertedWith(
      "Slot not mapped"
    );
  });
  it("Fail to get unmapped block", async () => {
    const { beaconOracle } = fixture;

    await expect(beaconOracle.blockToSlot(22814098)).to.be.revertedWith(
      "Block not mapped"
    );
  });
});
