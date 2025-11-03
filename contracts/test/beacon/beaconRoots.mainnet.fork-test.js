const { expect } = require("chai");

const { bytes32 } = require("../../utils/regex");

describe("ForkTest: Beacon Roots", function () {
  this.timeout(0);

  let provider;
  let beaconRoots;
  beforeEach(async () => {
    // Get provider to mainnet and not a local fork
    provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
    beaconRoots = await ethers.getContract("MockBeaconRoots", provider);
  });

  it("Should get the latest beacon root", async () => {
    const results = await beaconRoots.latestBlockRoot();

    expect(results.parentRoot).to.match(bytes32);
  });
  it("Should to get beacon root from the current block", async () => {
    // Get the current block from the execution layer
    const currentBlock = await provider.getBlock();

    expect(await beaconRoots.parentBlockRoot(currentBlock.timestamp)).to.match(
      bytes32
    );
  });
  it("Should to get beacon root from the previous block", async () => {
    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    // Get the timestamp of an old block before the local fork
    const previousBlock = await beaconRoots.provider.getBlock(
      currentBlockNumber - 1
    );

    expect(await beaconRoots.parentBlockRoot(previousBlock.timestamp)).to.match(
      bytes32
    );
  });
  it("Should get beacon root from old block", async () => {
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
    // Get the current block number from the execution layer
    const currentBlockNumber = await beaconRoots.provider.getBlockNumber();

    // Get the timestamp of the block from 10,000 blocks ago
    const previousBlock = await beaconRoots.provider.getBlock(
      currentBlockNumber - 10000
    );
    const previousTimestamp = previousBlock.timestamp;

    await expect(beaconRoots.parentBlockRoot(previousTimestamp)).to.be.reverted;
  });
});
