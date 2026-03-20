const { createFixtureLoader } = require("../_fixture");
const { defaultHyperEVMFixture } = require("../_fixture-hyperevm");
const { expect } = require("chai");
const { advanceTime, advanceBlocks } = require("../helpers");

const hyperEvmFixture = createFixtureLoader(defaultHyperEVMFixture);

describe("ForkTest: HyperEVM Timelock", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await hyperEvmFixture();
  });

  it("Multisig can propose and execute on Timelock", async () => {
    const { admin, timelock, crossChainRemoteStrategy } = fixture;

    const newHarvesterAddress = admin.address;
    const calldata = crossChainRemoteStrategy.interface.encodeFunctionData(
      "setHarvesterAddress(address)",
      [newHarvesterAddress]
    );

    const args = [
      [crossChainRemoteStrategy.address], // Targets
      [0], // Values
      [calldata], // Calldata
      "0x0000000000000000000000000000000000000000000000000000000000000000", // Predecessor
      "0x0000000000000000000000000000000000000000000000000000000000000001", // Salt
    ];

    const minDelay = await timelock.getMinDelay();

    await timelock.connect(admin).scheduleBatch(
      ...args,
      minDelay // minDelay
    );

    // Wait for timelock
    await advanceTime(minDelay.toNumber() + 10);
    await advanceBlocks(2);

    await timelock.connect(admin).executeBatch(...args);

    expect(await crossChainRemoteStrategy.harvesterAddress()).to.eq(
      newHarvesterAddress
    );
  });
});
