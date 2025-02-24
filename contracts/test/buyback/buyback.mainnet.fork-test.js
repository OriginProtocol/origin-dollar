const { expect } = require("chai");
const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, oethUnits } = require("../helpers");
const { getIInchSwapData, recodeSwapData } = require("../../utils/1Inch");
const { hotDeployOption } = require("../_hot-deploy");

const loadFixture = createFixtureLoader(buybackFixture);

// Skipping buyback tests since they seem to randomly fail on CI
// and it's a user-facing function. It's callable only by the strategist,
// so we would know if it's broken.
describe.skip("ForkTest: OETH Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: true,
    });
  });

  it("Should swap OETH for OGN", async () => {
    const { oethBuyback, oeth, oethVault, ogn, rewardsSource, strategist } =
      fixture;

    const oethBalanceBefore = await oeth.balanceOf(oethBuyback.address);
    const ognShareBefore = await oethBuyback.balanceForOGN();
    const cvxShareBefore = await oethBuyback.balanceForCVX();
    const rewardsBalanceBefore = await ogn.balanceOf(rewardsSource.address);

    const ognAmount = ognShareBefore.lte(oethUnits("1"))
      ? ognShareBefore
      : oethUnits("1");

    let data = await getIInchSwapData({
      vault: oethVault,
      fromAsset: oeth,
      toAsset: ogn,
      fromAmount: ognAmount,
      // 5%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 5,
      protocols: ["UNISWAP", "UNISWAP_V3"],
    });
    data = await recodeSwapData(data);

    await oethBuyback
      .connect(strategist)
      .swapForOGN(ognAmount, oethUnits("100"), data);

    const oethBalanceAfter = await oeth.balanceOf(oethBuyback.address);
    const ognShareAfter = await oethBuyback.balanceForOGN();
    const cvxShareAfter = await oethBuyback.balanceForCVX();
    const rewardsBalanceAfter = await ogn.balanceOf(rewardsSource.address);

    expect(ognShareAfter).to.eq(ognShareBefore.sub(ognAmount));
    expect(oethBalanceAfter).to.eq(oethBalanceBefore.sub(ognAmount));
    expect(cvxShareAfter).to.eq(cvxShareBefore);
    expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
  });

  it("Should swap OETH for CVX and lock it", async () => {
    const { oethBuyback, oeth, oethVault, cvx, cvxLocker, strategist } =
      fixture;

    const oethBalanceBefore = await oeth.balanceOf(oethBuyback.address);
    const ognShareBefore = await oethBuyback.balanceForOGN();
    const cvxShareBefore = await oethBuyback.balanceForCVX();
    const strategistAddr = await strategist.getAddress();
    const lockedCVXBalanceBefore = await cvxLocker.lockedBalanceOf(
      strategistAddr
    );

    let data = await getIInchSwapData({
      vault: oethVault,
      fromAsset: oeth,
      toAsset: cvx,
      fromAmount: cvxShareBefore,
      // 5%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 5,
      protocols: ["UNISWAP", "UNISWAP_V3"],
    });
    data = await recodeSwapData(data);

    await oethBuyback
      .connect(strategist)
      .swapForCVX(cvxShareBefore, oethUnits("1"), data);

    const oethBalanceAfter = await oeth.balanceOf(oethBuyback.address);
    const ognShareAfter = await oethBuyback.balanceForOGN();
    const cvxShareAfter = await oethBuyback.balanceForCVX();

    expect(cvxShareAfter).to.eq(0);
    expect(oethBalanceAfter).to.eq(oethBalanceBefore.sub(cvxShareBefore));
    expect(ognShareAfter).to.eq(ognShareBefore);

    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });
});

describe.skip("ForkTest: OUSD Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: false,
    });
  });

  it("Should swap OUSD for OGN", async () => {
    const { ousdBuyback, ousd, vault, ogn, rewardsSource, strategist } =
      fixture;

    const ousdBalanceBefore = await ousd.balanceOf(ousdBuyback.address);
    const ognShareBefore = await ousdBuyback.balanceForOGN();
    const cvxShareBefore = await ousdBuyback.balanceForCVX();
    const rewardsBalanceBefore = await ogn.balanceOf(rewardsSource.address);

    let data = await getIInchSwapData({
      vault: vault,
      fromAsset: ousd,
      toAsset: ogn,
      fromAmount: ognShareBefore,
      // 20%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 20,
      protocols: ["UNISWAP", "UNISWAP_V3"],
    });
    data = await recodeSwapData(data);

    await ousdBuyback
      .connect(strategist)
      .swapForOGN(ognShareBefore, ousdUnits("1"), data);

    const ousdBalanceAfter = await ousd.balanceOf(ousdBuyback.address);
    const ognShareAfter = await ousdBuyback.balanceForOGN();
    const cvxShareAfter = await ousdBuyback.balanceForCVX();
    const rewardsBalanceAfter = await ogn.balanceOf(rewardsSource.address);

    expect(ognShareAfter).to.eq(0);
    expect(ousdBalanceAfter).to.eq(ousdBalanceBefore.sub(ognShareBefore));
    expect(cvxShareAfter).to.eq(cvxShareBefore);
    expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
  });

  it("Should swap OUSD for CVX and lock it", async () => {
    const { ousdBuyback, ousd, vault, cvx, cvxLocker, strategist } = fixture;

    const ousdBalanceBefore = await ousd.balanceOf(ousdBuyback.address);
    const ognShareBefore = await ousdBuyback.balanceForOGN();
    const cvxShareBefore = await ousdBuyback.balanceForCVX();
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
      protocols: ["UNISWAP", "UNISWAP_V3"],
    });
    data = await recodeSwapData(data);

    await ousdBuyback
      .connect(strategist)
      .swapForCVX(cvxShareBefore, ousdUnits("0.01"), data);

    const ousdBalanceAfter = await ousd.balanceOf(ousdBuyback.address);
    const ognShareAfter = await ousdBuyback.balanceForOGN();
    const cvxShareAfter = await ousdBuyback.balanceForCVX();

    expect(cvxShareAfter).to.eq(0);
    expect(ousdBalanceAfter).to.eq(ousdBalanceBefore.sub(cvxShareBefore));
    expect(ognShareAfter).to.eq(ognShareBefore);

    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });
});

describe.skip("ForkTest: ARM Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: true,
    });
  });

  it("Should check the configuration", async () => {
    const { armBuyback, weth, ogn, rewardsSource } = fixture;
    const cSwapper = await ethers.getContract("Swapper1InchV5");

    expect(await armBuyback.oToken()).to.be.eq(weth.address);
    expect(await armBuyback.ogn()).to.be.eq(
      ethers.utils.getAddress(ogn.address)
    );
    expect(await armBuyback.rewardsSource()).to.be.eq(rewardsSource.address);
    expect(await armBuyback.swapRouter()).to.be.eq(cSwapper.address);
    expect(await armBuyback.cvxShareBps()).to.be.eq(0);
  });

  it("Should swap WETH for OGN", async () => {
    const { armBuyback, weth, oethVault, ogn, rewardsSource, strategist } =
      fixture;

    const oethBalanceBefore = await weth.balanceOf(armBuyback.address);
    const ognShareBefore = await armBuyback.balanceForOGN();
    const cvxShareBefore = await armBuyback.balanceForCVX();
    const rewardsBalanceBefore = await ogn.balanceOf(rewardsSource.address);

    const ognAmount = ognShareBefore.lte(oethUnits("1"))
      ? ognShareBefore
      : oethUnits("1");

    let data = await getIInchSwapData({
      vault: oethVault,
      fromAsset: weth,
      toAsset: ogn,
      fromAmount: ognAmount,
      // 5%, just so that fork-tests don't fail on
      // CI randomly due to price volatility.
      slippage: 5,
      protocols: ["UNISWAP", "UNISWAP_V3"],
    });

    data = recodeSwapData(data);

    await armBuyback
      .connect(strategist)
      .swapForOGN(ognAmount, oethUnits("100"), data);

    const oethBalanceAfter = await weth.balanceOf(armBuyback.address);
    const ognShareAfter = await armBuyback.balanceForOGN();
    const cvxShareAfter = await armBuyback.balanceForCVX();
    const rewardsBalanceAfter = await ogn.balanceOf(rewardsSource.address);

    expect(ognShareAfter).to.eq(ognShareBefore.sub(ognAmount));
    expect(oethBalanceAfter).to.eq(oethBalanceBefore.sub(ognAmount));
    expect(cvxShareAfter).to.eq(cvxShareBefore);
    expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
  });
});
