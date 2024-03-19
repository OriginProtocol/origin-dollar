const { expect } = require("chai");
const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, oethUnits } = require("../helpers");
const { getIInchSwapData, recodeSwapData } = require("../../utils/1Inch");
const { hotDeployOption } = require("../_hot-deploy");

const loadFixture = createFixtureLoader(buybackFixture);

describe("ForkTest: OETH Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: true,
    });
  });

  it("Should swap OETH for OGV", async () => {
    const { oethBuyback, oeth, oethVault, ogv, rewardsSource, strategist } =
      fixture;

    const oethBalanceBefore = await oeth.balanceOf(oethBuyback.address);
    const ogvShareBefore = await oethBuyback.ogvShare();
    const cvxShareBefore = await oethBuyback.cvxShare();
    const rewardsBalanceBefore = await ogv.balanceOf(rewardsSource.address);

    let data = await getIInchSwapData({
      vault: oethVault,
      fromAsset: oeth,
      toAsset: ogv,
      fromAmount: ogvShareBefore,
      // 20%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 20,
    });
    data = await recodeSwapData(data);

    await oethBuyback
      .connect(strategist)
      .swapForOGV(ogvShareBefore, oethUnits("100"), data);

    const oethBalanceAfter = await oeth.balanceOf(oethBuyback.address);
    const ogvShareAfter = await oethBuyback.ogvShare();
    const cvxShareAfter = await oethBuyback.cvxShare();
    const rewardsBalanceAfter = await ogv.balanceOf(rewardsSource.address);

    expect(ogvShareAfter).to.eq(0);
    expect(oethBalanceAfter).to.eq(oethBalanceBefore.sub(ogvShareBefore));
    expect(cvxShareAfter).to.eq(cvxShareBefore);
    expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
  });

  it("Should swap OETH for CVX and lock it", async () => {
    const { oethBuyback, oeth, oethVault, cvx, cvxLocker, strategist } =
      fixture;

    const oethBalanceBefore = await oeth.balanceOf(oethBuyback.address);
    const ogvShareBefore = await oethBuyback.ogvShare();
    const cvxShareBefore = await oethBuyback.cvxShare();
    const strategistAddr = await strategist.getAddress();
    const lockedCVXBalanceBefore = await cvxLocker.lockedBalanceOf(
      strategistAddr
    );

    let data = await getIInchSwapData({
      vault: oethVault,
      fromAsset: oeth,
      toAsset: cvx,
      fromAmount: cvxShareBefore,
      // 20%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 20,
    });
    data = await recodeSwapData(data);

    await oethBuyback
      .connect(strategist)
      .swapForCVX(cvxShareBefore, oethUnits("1"), data);

    const oethBalanceAfter = await oeth.balanceOf(oethBuyback.address);
    const ogvShareAfter = await oethBuyback.ogvShare();
    const cvxShareAfter = await oethBuyback.cvxShare();

    expect(cvxShareAfter).to.eq(0);
    expect(oethBalanceAfter).to.eq(oethBalanceBefore.sub(cvxShareBefore));
    expect(ogvShareAfter).to.eq(ogvShareBefore);

    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });
});

describe("ForkTest: OUSD Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: false,
    });
  });

  it("Should swap OUSD for OGV", async () => {
    const { ousdBuyback, ousd, vault, ogv, rewardsSource, strategist } =
      fixture;

    const ousdBalanceBefore = await ousd.balanceOf(ousdBuyback.address);
    const ogvShareBefore = await ousdBuyback.ogvShare();
    const cvxShareBefore = await ousdBuyback.cvxShare();
    const rewardsBalanceBefore = await ogv.balanceOf(rewardsSource.address);

    let data = await getIInchSwapData({
      vault: vault,
      fromAsset: ousd,
      toAsset: ogv,
      fromAmount: ogvShareBefore,
      // 20%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 20,
    });
    data = await recodeSwapData(data);

    await ousdBuyback
      .connect(strategist)
      .swapForOGV(ogvShareBefore, ousdUnits("1"), data);

    const ousdBalanceAfter = await ousd.balanceOf(ousdBuyback.address);
    const ogvShareAfter = await ousdBuyback.ogvShare();
    const cvxShareAfter = await ousdBuyback.cvxShare();
    const rewardsBalanceAfter = await ogv.balanceOf(rewardsSource.address);

    expect(ogvShareAfter).to.eq(0);
    expect(ousdBalanceAfter).to.eq(ousdBalanceBefore.sub(ogvShareBefore));
    expect(cvxShareAfter).to.eq(cvxShareBefore);
    expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
  });

  it("Should swap OUSD for CVX and lock it", async () => {
    const { ousdBuyback, ousd, vault, cvx, cvxLocker, strategist } = fixture;

    const ousdBalanceBefore = await ousd.balanceOf(ousdBuyback.address);
    const ogvShareBefore = await ousdBuyback.ogvShare();
    const cvxShareBefore = await ousdBuyback.cvxShare();
    const strategistAddr = await strategist.getAddress();
    const lockedCVXBalanceBefore = await cvxLocker.lockedBalanceOf(
      strategistAddr
    );

    let data = await getIInchSwapData({
      vault: vault,
      fromAsset: ousd,
      toAsset: cvx,
      fromAmount: cvxShareBefore,
      // 20%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 20,
    });
    data = await recodeSwapData(data);

    await ousdBuyback
      .connect(strategist)
      .swapForCVX(cvxShareBefore, ousdUnits("0.01"), data);

    const ousdBalanceAfter = await ousd.balanceOf(ousdBuyback.address);
    const ogvShareAfter = await ousdBuyback.ogvShare();
    const cvxShareAfter = await ousdBuyback.cvxShare();

    expect(cvxShareAfter).to.eq(0);
    expect(ousdBalanceAfter).to.eq(ousdBalanceBefore.sub(cvxShareBefore));
    expect(ogvShareAfter).to.eq(ogvShareBefore);

    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });
});
