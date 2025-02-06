const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");

const baseFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Origin Sonic Token", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it.only("Should have SwapX pool's yield forwarded to a SwapX multisig address", async () => {
    const { oSonic } = fixture;

    // SwapX OS / USDC.e pool: 0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96
    // SwapX multisig account: 0xd100a01e00000000000000000000000000000001 TODO CHANGE
    expect(
      await oSonic.yieldFrom("0xD100a01e00000000000000000000000000000001")
    ).to.equal("0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96");
    expect(
      await oSonic.yieldTo("0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96")
    ).to.equal("0xD100a01e00000000000000000000000000000001");
  });
});
