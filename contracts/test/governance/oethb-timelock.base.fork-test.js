const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { advanceTime, advanceBlocks } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb Timelock", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Multisig can propose and execute on Timelock", async () => {
    const { guardian, timelock, oethbVault } = fixture;

    const calldata = oethbVault.interface.encodeFunctionData(
      "setDripper(address)",
      [addresses.dead]
    );

    const args = [
      [oethbVault.address], // Targets
      [0], // Values
      [calldata], // Calldata,
      "0x0000000000000000000000000000000000000000000000000000000000000000", // Predecessor
      "0x0000000000000000000000000000000000000000000000000000000000000001", // Salt
    ];

    const minDelay = await timelock.getMinDelay();

    await timelock.connect(guardian).scheduleBatch(
      ...args,
      minDelay // minDelay
    );

    // Wait for timelock
    await advanceTime(minDelay.toNumber() + 10);
    await advanceBlocks(2);

    await timelock.connect(guardian).executeBatch(...args);

    expect(await oethbVault.dripper()).to.eq(addresses.dead);
  });
});
