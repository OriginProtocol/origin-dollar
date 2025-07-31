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

  it("Should have OS/GEMSx SwapX pool's yield forwarded to a pool booster", async () => {
    const { oSonic } = fixture;

    // SwapX OS / GEMSx pool: 0xeDFa946815c5CDb14BF894aEd1542D3049a7Be0c
    // SwapX OS/ GEMSx pool booster: 0x1ea8Db4053f806636250bb2BFa6B1E0c4923c209
    expect(
      await oSonic.yieldFrom("0x1ea8Db4053f806636250bb2BFa6B1E0c4923c209")
    ).to.equal("0xeDFa946815c5CDb14BF894aEd1542D3049a7Be0c");
    expect(
      await oSonic.yieldTo("0xeDFa946815c5CDb14BF894aEd1542D3049a7Be0c")
    ).to.equal("0x1ea8Db4053f806636250bb2BFa6B1E0c4923c209");
  });
});
