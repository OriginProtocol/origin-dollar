const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits, getBlockTimestamp, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { BigNumber } = require("ethers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb FixedRateDripper", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should collect reward at fixed rate", async () => {
    const { dripper, weth, oethbVault } = fixture;

    // Fund dripper with some WETH
    const dripperSigner = await impersonateAndFund(dripper.address);
    await weth.connect(dripperSigner).deposit({ value: oethUnits("50") });

    const dripperBalanceBefore = await weth.balanceOf(dripper.address);
    const vaultBalanceBefore = await weth.balanceOf(oethbVault.address);

    // Get current rate
    const drip = await dripper.drip();
    const currTimestamp = await getBlockTimestamp();

    // Fast forward time
    const oneDay = 24 * 60 * 60;
    await advanceTime(oneDay); // 1d

    const elapsedTime = BigNumber.from(currTimestamp)
      .sub(drip.lastCollect)
      .add(oneDay);
    const expectedRewards = elapsedTime.mul(drip.perSecond);

    // Do a collect
    await dripper.collect();

    // Check state
    const dripperBalanceAfter = await weth.balanceOf(dripper.address);
    const vaultBalanceAfter = await weth.balanceOf(oethbVault.address);

    expect(dripperBalanceAfter).to.approxEqual(
      dripperBalanceBefore.sub(expectedRewards)
    );
    expect(vaultBalanceAfter).to.approxEqual(
      vaultBalanceBefore.add(expectedRewards)
    );

    // Make sure drip rate hasn't changed
    const dripAfter = await dripper.drip();
    expect(dripAfter.perSecond).to.eq(drip.perSecond);
    // ... and lastCollect has been updated
    expect(dripAfter.lastCollect).to.gte(drip.lastCollect.add(elapsedTime));
  });

  it("Should allow strategist/governor to change rate", async () => {
    const { dripper, strategist, governor } = fixture;

    let tx = await dripper.connect(strategist).setDripRate(
      oethUnits("1") // 1 WETH per second
    );
    await expect(tx).to.emit(dripper, "DripRateUpdated");

    let rate = (await dripper.drip()).perSecond;
    expect(rate).to.eq(oethUnits("1"));

    tx = await dripper.connect(governor).setDripRate(
      oethUnits("2") // 2 WETH per second
    );
    await expect(tx).to.emit(dripper, "DripRateUpdated");

    rate = (await dripper.drip()).perSecond;
    expect(rate).to.eq(oethUnits("2"));
  });

  it("Should not allow anyone else to change rate", async () => {
    const { dripper, nick } = fixture;

    const tx = dripper.connect(nick).setDripRate(
      oethUnits("1") // 1 WETH per second
    );
    await expect(tx).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Should allow to disable rate", async () => {
    const { dripper, strategist } = fixture;

    const tx = await dripper.connect(strategist).setDripRate(
      "0" // Disable dripping
    );
    await expect(tx).to.emit(dripper, "DripRateUpdated");

    expect((await dripper.drip()).perSecond).to.eq("0");
  });

  it("Should have disabled drip duration", async () => {
    const { dripper, governor } = fixture;

    const tx = dripper.connect(governor).setDripDuration("7");
    await expect(tx).to.be.revertedWith("Drip duration disabled");
  });
});
