const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { oethUnits, advanceTime, advanceBlocks } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb Harvester", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();

    // Forward time & block to simulate some yields
    await advanceTime(12 * 60 * 60); // 12h
    await advanceBlocks(300);
  });

  it("should have whitelisted the strategies", async () => {
    const { harvester, aerodromeAmoStrategy, curveAMOStrategy } = fixture;
    expect(await harvester.supportedStrategies(aerodromeAmoStrategy.address)).to
      .be.true;
    expect(await harvester.supportedStrategies(curveAMOStrategy.address)).to.be
      .true;
  });

  it("should have vault configured as the dripper", async () => {
    const { harvester, oethbVault } = fixture;
    expect(await harvester.dripper()).to.eq(oethbVault.address);
  });

  it("Should harvest from Aerodrome AMO strategy", async () => {
    const { strategist, harvester, aerodromeAmoStrategy, aeroClGauge, aero } =
      fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    const balanceBefore = await aero.balanceOf(strategist.address);

    // Harvest
    // prettier-ignore
    await harvester
      .connect(strategist)["harvestAndTransfer(address)"](aerodromeAmoStrategy.address);

    // Check state
    const balanceAfter = await aero.balanceOf(strategist.address);
    expect(balanceAfter).to.be.gte(balanceBefore.add(pendingRewards));

    const pendingRewardsAfter = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    expect(pendingRewardsAfter).to.eq(0);

    // Should do nothing when there's nothing to collect and transfer
    // prettier-ignore
    await harvester
      .connect(strategist)["harvestAndTransfer(address)"](aerodromeAmoStrategy.address);
  });

  it("Should harvest from Curve AMO strategy", async () => {
    const { strategist, harvester, curveAMOStrategy, crv } = fixture;
    // Fund the strategy with some CRV to mimic incentives
    await setERC20TokenBalance(curveAMOStrategy.address, crv, oethUnits("100"));
    const balanceBefore = await crv.balanceOf(strategist.address);

    // Harvest
    // prettier-ignore
    await harvester
      .connect(strategist)["harvestAndTransfer(address)"](curveAMOStrategy.address);

    // Check state
    const balanceAfter = await crv.balanceOf(strategist.address);
    expect(balanceAfter).to.be.gte(balanceBefore.add(oethUnits("100")));

    // Should do nothing when there's nothing to collect and transfer
    // prettier-ignore
    await harvester
      .connect(strategist)["harvestAndTransfer(address)"](curveAMOStrategy.address);
  });

  it("Should not harvest when strategist address isn't set", async () => {
    const { governor, harvester, aerodromeAmoStrategy, aero } = fixture;
    await harvester.connect(governor).setStrategistAddr(addresses.zero);

    await setERC20TokenBalance(
      aerodromeAmoStrategy.address,
      aero,
      oethUnits("100")
    );

    // prettier-ignore
    const tx = harvester
      .connect(governor)["harvestAndTransfer(address)"](aerodromeAmoStrategy.address);
    await expect(tx).to.be.revertedWith("Invalid receiver");
  });

  it("Should not harvest when the strategy isn't whitelisted", async () => {
    const { governor, harvester, oethbVault } = fixture;
    await oethbVault.connect(governor).setStrategistAddr(addresses.zero);

    // prettier-ignore
    const tx = harvester
      .connect(governor)["harvestAndTransfer(address)"](addresses.dead);
    await expect(tx).to.be.revertedWith("Strategy not supported");
  });

  it.skip("Should harvest and then swap", async function () {
    const {
      strategist,
      dripper,
      harvester,
      aerodromeAmoStrategy,
      aeroClGauge,
      aero,
      weth,
    } = fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    const aeroBalanceBefore = await aero.balanceOf(strategist.address);
    const wethBalanceBefore = await weth.balanceOf(strategist.address);
    const dripperWethBalanceBefore = await weth.balanceOf(dripper.address);

    const swapAmount = oethUnits("100");
    if (pendingRewards.lt(swapAmount)) {
      // Skip test when there isn't enough AERO to test swap
      return;
    }

    // Harvest
    const tx = await harvester.connect(strategist).harvestAndSwap(
      swapAmount, // Swap 100 AERO
      0, // minExpected WETH
      2000, // 20% fee
      true
    );

    const events = (await tx.wait()).events || [];
    const swapEvent = events.find((e) => e.event === "RewardTokenSwapped");
    const wethReceived = swapEvent.args.amountOut;

    const fee = wethReceived.mul(2000).div(10000);
    const protocolYield = wethReceived.sub(fee);

    // Check state
    const aeroBalanceAfter = await aero.balanceOf(strategist.address);
    expect(aeroBalanceAfter).to.be.gte(
      aeroBalanceBefore.add(pendingRewards).sub(swapAmount)
    );

    const wethBalanceAfter = await weth.balanceOf(strategist.address);
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(fee)
    );

    const dripperWethBalanceAfter = await weth.balanceOf(dripper.address);
    expect(dripperWethBalanceAfter).to.approxEqualTolerance(
      dripperWethBalanceBefore.add(protocolYield)
    );

    const pendingRewardsAfter = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    expect(pendingRewardsAfter).to.eq(0);
  });

  it.skip("Should harvest and then swap but not fund Dripper", async function () {
    const {
      strategist,
      dripper,
      harvester,
      aerodromeAmoStrategy,
      aeroClGauge,
      aero,
      weth,
    } = fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    const aeroBalanceBefore = await aero.balanceOf(strategist.address);
    const wethBalanceBefore = await weth.balanceOf(strategist.address);
    const dripperWethBalanceBefore = await weth.balanceOf(dripper.address);

    const swapAmount = oethUnits("100");
    if (pendingRewards.lt(swapAmount)) {
      // Skip test when there isn't enough AERO to test swap
      return;
    }

    // Harvest
    const tx = await harvester.connect(strategist).harvestAndSwap(
      swapAmount, // Swap 100 AERO
      0, // minExpected WETH
      2000, // 20% fee
      false
    );

    const events = (await tx.wait()).events || [];
    const swapEvent = events.find((e) => e.event === "RewardTokenSwapped");
    const wethReceived = swapEvent.args.amountOut;

    const fee = wethReceived.mul(2000).div(10000);
    const protocolYield = wethReceived.sub(fee);

    // Check state
    const aeroBalanceAfter = await aero.balanceOf(strategist.address);
    expect(aeroBalanceAfter).to.be.gte(
      aeroBalanceBefore.add(pendingRewards).sub(swapAmount)
    );

    const wethBalanceAfter = await weth.balanceOf(strategist.address);
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(fee).add(protocolYield)
    );

    const dripperWethBalanceAfter = await weth.balanceOf(dripper.address);
    expect(dripperWethBalanceAfter).to.approxEqualTolerance(
      dripperWethBalanceBefore
    );

    const pendingRewardsAfter = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    expect(pendingRewardsAfter).to.eq(0);
  });

  it.skip("Should harvest and then swap (0% fee)", async function () {
    const {
      strategist,
      dripper,
      harvester,
      aerodromeAmoStrategy,
      aeroClGauge,
      aero,
      weth,
    } = fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    const aeroBalanceBefore = await aero.balanceOf(strategist.address);
    const wethBalanceBefore = await weth.balanceOf(strategist.address);
    const dripperWethBalanceBefore = await weth.balanceOf(dripper.address);

    const swapAmount = oethUnits("100");
    if (pendingRewards.lt(swapAmount)) {
      // Skip test when there isn't enough AERO to test swap
      return;
    }

    // Harvest
    const tx = await harvester.connect(strategist).harvestAndSwap(
      swapAmount, // Swap 100 AERO
      0, // minExpected WETH
      0, // 0% fee
      true
    );

    const events = (await tx.wait()).events || [];
    const swapEvent = events.find((e) => e.event === "RewardTokenSwapped");
    const wethReceived = swapEvent.args.amountOut;

    const fee = 0;
    const protocolYield = wethReceived;

    // Check state
    const aeroBalanceAfter = await aero.balanceOf(strategist.address);
    expect(aeroBalanceAfter).to.be.gte(
      aeroBalanceBefore.add(pendingRewards).sub(swapAmount)
    );

    const wethBalanceAfter = await weth.balanceOf(strategist.address);
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(fee)
    );

    const dripperWethBalanceAfter = await weth.balanceOf(dripper.address);
    expect(dripperWethBalanceAfter).to.approxEqualTolerance(
      dripperWethBalanceBefore.add(protocolYield)
    );

    const pendingRewardsAfter = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    expect(pendingRewardsAfter).to.eq(0);
  });

  it.skip("Should harvest and then swap (100% fee)", async function () {
    const {
      strategist,
      dripper,
      harvester,
      aerodromeAmoStrategy,
      aeroClGauge,
      aero,
      weth,
    } = fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    const aeroBalanceBefore = await aero.balanceOf(strategist.address);
    const wethBalanceBefore = await weth.balanceOf(strategist.address);
    const dripperWethBalanceBefore = await weth.balanceOf(dripper.address);

    const swapAmount = oethUnits("100");
    if (pendingRewards.lt(swapAmount)) {
      // Skip test when there isn't enough AERO to test swap
      return;
    }

    // Harvest
    const tx = await harvester.connect(strategist).harvestAndSwap(
      swapAmount, // Swap 100 AERO
      0, // minExpected WETH
      10000, // 100% fee
      true
    );

    const events = (await tx.wait()).events || [];
    const swapEvent = events.find((e) => e.event === "RewardTokenSwapped");
    const wethReceived = swapEvent.args.amountOut;

    const fee = wethReceived;
    const protocolYield = 0;

    // Check state
    const aeroBalanceAfter = await aero.balanceOf(strategist.address);
    expect(aeroBalanceAfter).to.be.gte(
      aeroBalanceBefore.add(pendingRewards).sub(swapAmount)
    );

    const wethBalanceAfter = await weth.balanceOf(strategist.address);
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(fee)
    );

    const dripperWethBalanceAfter = await weth.balanceOf(dripper.address);
    expect(dripperWethBalanceAfter).to.approxEqualTolerance(
      dripperWethBalanceBefore.add(protocolYield)
    );

    const pendingRewardsAfter = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );
    expect(pendingRewardsAfter).to.eq(0);
  });

  it.skip("Should not harvest & swap with no dripper address", async function () {
    const { governor, harvester, oethbVault } = fixture;
    await oethbVault.connect(governor).setDripper(addresses.zero);

    const tx = harvester
      .connect(governor)
      .harvestAndSwap(oethUnits("100"), 0, 2000, true);
    await expect(tx).to.be.revertedWith("Yield recipient not set");
  });

  it.skip("Should not allow harvest & swap by non-governor/strategist", async () => {
    const { nick, harvester } = fixture;

    const tx = harvester
      .connect(nick)
      .harvestAndSwap(oethUnits("100"), 0, 2000, true);
    await expect(tx).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it.skip("Should not allow harvest & swap with incorrect feeBps", async () => {
    const { strategist, harvester } = fixture;

    const tx = harvester
      .connect(strategist)
      .harvestAndSwap(oethUnits("100"), 0, 10001, true);
    await expect(tx).to.be.revertedWith("Invalid Fee Bps");
  });

  it.skip("Should use strategist balance when needed for swaps", async () => {
    const { strategist, harvester, aero, aerodromeAmoStrategy, aeroClGauge } =
      fixture;
    const pendingRewards = await aeroClGauge.earned(
      aerodromeAmoStrategy.address,
      await aerodromeAmoStrategy.tokenId()
    );

    if (pendingRewards == 0) {
      // Skip when there's nothing to test
      return;
    }

    // Limit to smaller amount for test
    const amount = pendingRewards.gt(oethUnits("100"))
      ? oethUnits("100")
      : pendingRewards;

    // Let the contract move funds on behalf of strategist
    await aero
      .connect(strategist)
      .approve(harvester.address, oethUnits("1000000"));

    // Collect rewards first so strategist has itharvester
    await harvester.connect(strategist).harvest();

    const balanceBefore = await aero.balanceOf(strategist.address);

    await harvester.connect(strategist).harvestAndSwap(amount, 0, 2000, true);

    const balanceAfter = await aero.balanceOf(strategist.address);
    expect(balanceAfter).to.approxEqualTolerance(balanceBefore.sub(amount), 2);
  });

  it.skip("Should not harvest/swap when strategist address isn't set", async () => {
    const { governor, harvester, oethbVault } = fixture;
    await oethbVault.connect(governor).setStrategistAddr(addresses.zero);

    const tx = harvester
      .connect(governor)
      .harvestAndSwap(oethUnits("100"), 0, 2000, true);
    await expect(tx).to.be.revertedWith("Guardian address not set");
  });

  it("Should allow governor/strategist to transfer any arbitrary token", async () => {
    const { weth, clement, harvester, strategist, governor } = fixture;

    // Clement accidentally transfer 1 WETH to Harvester
    await weth.connect(clement).transfer(harvester.address, oethUnits("1"));

    const balanceBefore = await weth.balanceOf(strategist.address);

    // Strategist recovers it
    await harvester
      .connect(strategist)
      .transferToken(weth.address, oethUnits("0.4"));

    // And governor recovers it as well
    await harvester
      .connect(governor)
      .transferToken(weth.address, oethUnits("0.6"));

    // Check state
    const balanceAfter = await weth.balanceOf(strategist.address);
    expect(balanceAfter).to.eq(balanceBefore.add(oethUnits("1")));
  });

  it("Should not allow anyone else to recover tokens", async () => {
    const { weth, clement, harvester } = fixture;

    // Clement accidentally transfer 1 WETH to Harvester
    await weth.connect(clement).transfer(harvester.address, oethUnits("1"));

    // And he can't recover it by himself
    const tx = harvester
      .connect(clement)
      .transferToken(weth.address, oethUnits("1"));
    await expect(tx).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });
});
