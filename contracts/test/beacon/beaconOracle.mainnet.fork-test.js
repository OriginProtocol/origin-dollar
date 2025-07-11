const { expect } = require("chai");
const { before } = require("mocha");

const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { toHex } = require("../../utils/units");
const { getBeaconBlock, getSlot } = require("../../utils/beacon");
const { generateSlotProof, generateBlockProof } = require("../../utils/proofs");

const log = require("../../utils/logger")("test:fork:beacon:oracle");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Oracle", function () {
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

    const pastBlockNumber = blockView.body.executionPayload.blockNumber;
    log(`Beacon block number: ${pastBlockNumber}`);

    const nextBlockNumber = pastBlockNumber + 1;
    const nextBlock = await remoteProvider.getBlock(nextBlockNumber);
    log(
      `Parent block timestamp ${nextBlock.timestamp} for next block ${nextBlock.number}`
    );

    const { proof: slotProof } = await generateSlotProof({
      blockView,
      blockTree,
    });

    const { proof: blokProof } = await generateBlockProof({
      blockView,
      blockTree,
    });

    log(`About to submit slot and block proofs`);
    const tx = await beaconOracle.verifySlot(
      nextBlock.timestamp,
      pastBlockNumber,
      pastSlot,
      slotProof,
      blokProof
    );
    await expect(tx)
      .to.emit(beaconOracle, "BlockToSlot")
      .withArgs(toHex(blockView.hashTreeRoot()), pastBlockNumber, pastSlot);

    log(`Proofs have been verified`);

    expect(await beaconOracle.blockToSlot(pastBlockNumber)).to.equal(pastSlot);
    expect(await beaconOracle.slotToBlock(pastSlot)).to.equal(pastBlockNumber);

    await expect(
      beaconOracle.verifySlot(
        nextBlock.timestamp,
        pastBlockNumber,
        pastSlot,
        slotProof,
        blokProof
      )
    ).to.revertedWith("Block already mapped");
  });
  it("Fail to verify a block using timestamp from the same block", async () => {
    // This will use the beacon block root of the previous block hence the verification of the proofs will fail.
    const { beaconOracle } = fixture;

    const pastBlockNumber = blockView.body.executionPayload.blockNumber;
    const pastBlock = await remoteProvider.getBlock(pastBlockNumber);

    const { proof: slotProof } = await generateSlotProof({
      blockView,
      blockTree,
    });

    const { proof: blokProof } = await generateBlockProof({
      blockView,
      blockTree,
    });

    await expect(
      beaconOracle.verifySlot(
        pastBlock.timestamp,
        pastBlockNumber,
        pastSlot,
        slotProof,
        blokProof
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
