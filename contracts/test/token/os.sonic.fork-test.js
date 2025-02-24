const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");

const baseFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Origin Sonic Token", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it.skip("Should have OS/USDC.e SwapX pool's yield forwarded to a SwapX multisig address", async () => {
    const { oSonic } = fixture;

    // SwapX OS / USDC.e pool: 0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96
    // SwapX multisig account: 0x4636269e7CDc253F6B0B210215C3601558FE80F6
    expect(
      await oSonic.yieldFrom("0x4636269e7CDc253F6B0B210215C3601558FE80F6")
    ).to.equal("0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96");
    expect(
      await oSonic.yieldTo("0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96")
    ).to.equal("0x4636269e7CDc253F6B0B210215C3601558FE80F6");
  });

  it("Should have OS/GEMSx SwapX pool's yield forwarded to a SwapX multisig address", async () => {
    const { oSonic } = fixture;

    // SwapX OS / GEMSx pool: 0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5
    // SwapX multisig account: 0xE2c01Cc951E8322992673Fa2302054375636F7DE
    expect(
      await oSonic.yieldFrom("0xE2c01Cc951E8322992673Fa2302054375636F7DE")
    ).to.equal("0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5");
    expect(
      await oSonic.yieldTo("0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5")
    ).to.equal("0xE2c01Cc951E8322992673Fa2302054375636F7DE");
  });
});
