const { expect } = require("chai");
const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, oethUnits } = require("../helpers");

const loadFixture = createFixtureLoader(buybackFixture);

describe("ForkTest: Buyback", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should swap OETH for OGV and CVX", async () => {
    const { oethBuyback, oeth, ogv, cvxLocker, rewardsSource, strategist } =
      fixture;

    const oethBalanceBefore = await oeth.balanceOf(oethBuyback.address);
    const ogvBalanceBefore = await ogv.balanceOf(rewardsSource.address);
    const strategistAddr = await strategist.getAddress();
    const lockedCVXBalanceBefore = await cvxLocker.lockedBalanceOf(
      strategistAddr
    );

    await oethBuyback.connect(strategist).swap(
      // 1 OETH
      oethUnits("1"),
      oethUnits("50"),
      oethUnits("5")
    );

    // Make sure right amounts were swapped
    await expect(oethBuyback).to.have.a.balanceOf(
      oethBalanceBefore.sub(oethUnits("1")),
      oeth
    );

    // Check if OGV went to RewardsSource
    expect(await ogv.balanceOf(rewardsSource.address)).to.be.gt(
      ogvBalanceBefore
    );

    // Check if CVX has been locked
    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });

  it("Should swap OUSD for OGV and CVX", async () => {
    const { ousdBuyback, ousd, ogv, cvxLocker, rewardsSource, strategist } =
      fixture;

    const ousdBalanceBefore = await ousd.balanceOf(ousdBuyback.address);
    const ogvBalanceBefore = await ogv.balanceOf(rewardsSource.address);
    const strategistAddr = await strategist.getAddress();
    const lockedCVXBalanceBefore = await cvxLocker.lockedBalanceOf(
      strategistAddr
    );

    await ousdBuyback.connect(strategist).swap(
      // 800 OUSD
      ousdUnits("800"),
      ousdUnits("50"),
      ousdUnits("5")
    );

    // Make sure right amounts were swapped
    await expect(ousdBuyback).to.have.a.balanceOf(
      ousdBalanceBefore.sub(ousdUnits("800")),
      ousd
    );

    // Check if OGV went to RewardsSource
    expect(await ogv.balanceOf(rewardsSource.address)).to.be.gt(
      ogvBalanceBefore
    );

    // Check if CVX has been locked
    expect(await cvxLocker.lockedBalanceOf(strategistAddr)).to.be.gte(
      lockedCVXBalanceBefore
    );
  });
});
