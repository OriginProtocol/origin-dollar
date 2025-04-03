const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const { deployWithConfirmation } = require("../../../utils/deploy");
const { replaceContractAt } = require("../../../utils/hardhat");
const addresses = require("../../../utils/addresses");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Base Fork Test: Bridged WOETH Strategy", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should allow governor/strategist to mint with bridged WOETH", async () => {
    const { woeth, oethb, oethbVault, weth, woethStrategy, governor } = fixture;

    await oethbVault.rebase();

    const supplyBefore = await oethb.totalSupply();
    const userOETHbBalanceBefore = await oethb.balanceOf(governor.address);
    const userWOETHBalanceBefore = await woeth.balanceOf(governor.address);
    const stratBalanceBefore = await woethStrategy.checkBalance(weth.address);
    const stratWOETHBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const depositAmount = oethUnits("1");
    const expectedAmount = await woethStrategy.getBridgedWOETHValue(
      depositAmount
    );

    // Governor mints OETHb with wOETH
    await woeth.connect(governor).approve(woethStrategy.address, depositAmount);
    await woethStrategy.connect(governor).depositBridgedWOETH(depositAmount);

    const supplyDiff = (await oethb.totalSupply()).sub(supplyBefore);
    expect(supplyDiff).to.approxEqualTolerance(
      expectedAmount,
      1,
      "Incorrect supply change"
    );

    const userOETHbBalanceDiff = (await oethb.balanceOf(governor.address)).sub(
      userOETHbBalanceBefore
    );
    expect(userOETHbBalanceDiff).to.approxEqualTolerance(
      expectedAmount,
      1,
      "OETHb balance didn't increase"
    );

    const userWOETHBalanceDiff = userWOETHBalanceBefore.sub(
      await woeth.balanceOf(governor.address)
    );
    expect(userWOETHBalanceDiff).to.approxEqualTolerance(
      depositAmount,
      1,
      "User has more WOETH"
    );

    const stratBalanceDiff = (
      await woethStrategy.checkBalance(weth.address)
    ).sub(stratBalanceBefore);
    expect(stratBalanceDiff).to.approxEqualTolerance(
      expectedAmount,
      1,
      "Strategy reports more balance"
    );

    const stratWOETHBalanceDiff = (
      await woeth.balanceOf(woethStrategy.address)
    ).sub(stratWOETHBalanceBefore);
    expect(stratWOETHBalanceDiff).to.approxEqualTolerance(
      depositAmount,
      1,
      "Strategy has less WOETH"
    );
  });

  it("Should allow governor/strategist to get back bridged WOETH", async () => {
    const { woeth, oethb, oethbVault, weth, woethStrategy, governor } = fixture;

    await oethbVault.rebase();
    await woethStrategy.updateWOETHOraclePrice();

    const depositWOETHAmount = oethUnits("1");

    // Governor mints OETHb with wOETH
    await woeth
      .connect(governor)
      .approve(woethStrategy.address, depositWOETHAmount);
    await woethStrategy
      .connect(governor)
      .depositBridgedWOETH(depositWOETHAmount);

    const supplyBefore = await oethb.totalSupply();
    const userOETHbBalanceBefore = await oethb.balanceOf(governor.address);
    const userWOETHBalanceBefore = await woeth.balanceOf(governor.address);
    const stratBalanceBefore = await woethStrategy.checkBalance(weth.address);
    const stratWOETHBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const expectedOETHbAmount = await woethStrategy.getBridgedWOETHValue(
      depositWOETHAmount.sub(1)
    );

    // Approve strategy to move OETHb
    await oethb
      .connect(governor)
      .approve(woethStrategy.address, oethUnits("1000000"));

    // Governor tries to withdraw
    await woethStrategy
      .connect(governor)
      .withdrawBridgedWOETH(expectedOETHbAmount);

    const supplyDiff = supplyBefore.sub(await oethb.totalSupply());
    expect(supplyDiff).to.approxEqualTolerance(
      expectedOETHbAmount,
      1,
      "Incorrect supply change"
    );

    const userOETHbBalanceDiff = userOETHbBalanceBefore.sub(
      await oethb.balanceOf(governor.address)
    );
    expect(userOETHbBalanceDiff).to.approxEqualTolerance(
      expectedOETHbAmount,
      1,
      "OETHb balance didn't go down"
    );

    const userWOETHBalanceDiff = (await woeth.balanceOf(governor.address)).sub(
      userWOETHBalanceBefore
    );
    expect(userWOETHBalanceDiff).to.approxEqualTolerance(
      depositWOETHAmount,
      1,
      "User has less WOETH"
    );

    const stratBalanceDiff = stratBalanceBefore.sub(
      await woethStrategy.checkBalance(weth.address)
    );
    expect(stratBalanceDiff).to.approxEqualTolerance(
      expectedOETHbAmount,
      1,
      "Strategy reports incorrect balance"
    );

    const stratWOETHBalanceDiff = stratWOETHBalanceBefore.sub(
      await woeth.balanceOf(woethStrategy.address)
    );
    expect(stratWOETHBalanceDiff).to.approxEqualTolerance(
      depositWOETHAmount,
      1,
      "Strategy has more WOETH"
    );
  });

  it("Should handle yields from appreciation of WOETH value", async () => {
    const { woeth, oethb, oethbVault, weth, woethStrategy, governor } = fixture;

    await oethbVault.rebase();

    const depositAmount = oethUnits("1");
    const oracleFeed = await ethers.getContractAt(
      "AggregatorV3Interface",
      addresses.base.BridgedWOETHOracleFeed
    );
    const roundData = await oracleFeed.latestRoundData();

    // Governor mints OETHb with wOETH
    await woeth.connect(governor).approve(woethStrategy.address, depositAmount);
    await woethStrategy.connect(governor).depositBridgedWOETH(depositAmount);

    const supplyBefore = await oethb.totalSupply();
    // const userOETHbBalanceBefore = await oethb.balanceOf(governor.address);
    // const userWOETHBalanceBefore = await woeth.balanceOf(governor.address);
    const stratBalanceBefore = await woethStrategy.checkBalance(weth.address);
    const stratWOETHBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    // Deploy a mock oracle feed
    const dMockOracleFeed = await deployWithConfirmation(
      "MockChainlinkOracleFeed",
      [
        roundData.answer, // Initial price
        18, // Decimals
      ]
    );
    // Replace the feed with mock
    await replaceContractAt(
      addresses.base.BridgedWOETHOracleFeed,
      dMockOracleFeed
    );

    const cMockOracleFeed = await ethers.getContractAt(
      "MockChainlinkOracleFeed",
      addresses.base.BridgedWOETHOracleFeed
    );
    // Set price
    await cMockOracleFeed.connect(governor).setPrice(roundData.answer);
    await cMockOracleFeed.connect(governor).setDecimals(18);

    // Update price on strategy
    await woethStrategy.updateWOETHOraclePrice();

    expect(await woethStrategy.checkBalance(weth.address)).to.equal(
      stratBalanceBefore
    );

    // Increase the price by 0.5%
    await cMockOracleFeed.setPrice(roundData.answer.mul(1005).div(1000));

    // Strategy balance should've increased by 0.5%
    expect(
      await woethStrategy.checkBalance(weth.address)
    ).to.approxEqualTolerance(stratBalanceBefore.mul(1005).div(1000), 1);
    expect(await woeth.balanceOf(woethStrategy.address)).to.equal(
      stratWOETHBalanceBefore
    );

    // Should increase supply on rebase
    await oethbVault.rebase();

    // Should've increased supply
    expect(await oethb.totalSupply()).to.be.approxEqualTolerance(
      supplyBefore.add(stratBalanceBefore.mul(5).div(1000)),
      1
    );
  });
});
