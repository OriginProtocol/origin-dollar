const { expect } = require("chai");
const { utils } = require("ethers");

const { BigNumber } = require("ethers");
const { threepoolFixture } = require("../_fixture");
const { loadFixture, units, isFork } = require("../helpers");

describe("3Pool Strategy Standalone", function () {
  if (isFork) {
    this.timeout(0);
  }

  let governor,
    threePool,
    threePoolToken,
    tpStandalone,
    usdt,
    threePoolStrategy,
    threePoolGauge,
    anna;

  beforeEach(async function () {
    const fixture = await loadFixture(threepoolFixture);
    governor = fixture.governor;
    threePool = fixture.threePool;
    threePoolToken = fixture.threePoolToken;
    threePoolGauge = fixture.threePoolGauge;
    tpStandalone = fixture.tpStandalone;
    usdt = fixture.usdt;
    anna = fixture.anna;

    threePoolStrategy = tpStandalone.connect(governor);
  });

  const deposit = async (amount, asset) => {
    await asset
      .connect(governor)
      .transfer(threePoolStrategy.address, units(amount, asset));
    await threePoolStrategy.deposit(asset.address, units(amount, asset));
  };

  it("should allow safeApproveAllTokens to be called", async function () {
    threePoolStrategy = tpStandalone.connect(governor);
    const MAX = BigNumber.from(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const expectAllowanceRaw = async (expected, asset, owner, spender) => {
      const allowance = await asset.allowance(owner.address, spender.address);
      await expect(allowance).to.eq(expected);
    };

    await expectAllowanceRaw(MAX, usdt, threePoolStrategy, threePool);
    await expectAllowanceRaw(MAX, threePoolToken, threePoolStrategy, threePool);
    await expectAllowanceRaw(
      MAX,
      threePoolToken,
      threePoolStrategy,
      threePoolGauge
    );

    await deposit("150", usdt);
    await expectAllowanceRaw(
      MAX.sub((await units("150.0", usdt)).toString()),
      usdt,
      threePoolStrategy,
      threePool
    );

    await threePoolStrategy.safeApproveAllTokens();
    await expectAllowanceRaw(MAX, usdt, threePoolStrategy, threePool);
    await expectAllowanceRaw(MAX, threePoolToken, threePoolStrategy, threePool);
    await expectAllowanceRaw(
      MAX,
      threePoolToken,
      threePoolStrategy,
      threePoolGauge
    );
  });

  it("Should read reward liquidation threshold", async () => {
    expect(await tpStandalone.rewardLiquidationThreshold()).to.equal("0");
  });

  it("Should allow Governor to set reward liquidation threshold", async () => {
    await tpStandalone
      .connect(governor)
      .setRewardLiquidationThreshold(utils.parseUnits("1", 18));
    expect(await tpStandalone.rewardLiquidationThreshold()).to.equal(
      utils.parseUnits("1", 18)
    );
  });

  it("Should not allow non-Governor to set reward liquidation threshold", async () => {
    await expect(
      tpStandalone
        .connect(anna)
        .setRewardLiquidationThreshold(utils.parseUnits("10", 18))
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
