const { expect } = require("chai");
const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const { bytes32 } = require("../../utils/regex");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Roots", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Fail to get beacon root from the current block", async () => {
    const { beaconRoots } = fixture;

    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    await expect(
      beaconRoots.parentBlockRoot(currentBlockNumber)
    ).to.be.revertedWith("Timestamp out of range");
  });
  it("Fail to get beacon root from the previous block", async () => {
    // This test passes as the fork has incremented blocks without updating the Beacon Roots contract.
    const { beaconRoots } = fixture;

    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    // Get the timestamp of an old block before the local fork
    const previousBlock = await beaconRoots.provider.getBlock(
      currentBlockNumber - 1
    );
    const previousTimestamp = previousBlock.timestamp;

    await expect(
      beaconRoots.parentBlockRoot(previousTimestamp)
    ).to.be.revertedWith("Invalid beacon timestamp");
  });
  it("Should get beacon root from old block", async () => {
    const { beaconRoots } = fixture;

    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    // Get the timestamp of an old block before the local fork
    const olderBlock = await beaconRoots.provider.getBlock(
      currentBlockNumber - 1000
    );
    const olderTimestamp = olderBlock.timestamp;

    const root = await beaconRoots.parentBlockRoot(olderTimestamp);
    expect(root).to.match(bytes32);
  });
  it("Fail to get beacon root from block older than the buffer", async () => {
    const { beaconRoots } = fixture;

    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    // Get the timestamp of the block from 10,000 blocks ago
    const previousBlock = await beaconRoots.provider.getBlock(
      currentBlockNumber - 10000
    );
    const previousTimestamp = previousBlock.timestamp;

    await expect(
      beaconRoots.parentBlockRoot(previousTimestamp)
    ).to.be.revertedWith("Timestamp out of range");
  });
});
