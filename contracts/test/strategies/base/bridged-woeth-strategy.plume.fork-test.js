const { createFixtureLoader } = require("../../_fixture");
const { defaultPlumeFixture } = require("../../_fixture-plume");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const { deployWithConfirmation } = require("../../../utils/deploy");
const { replaceContractAt } = require("../../../utils/hardhat");
const addresses = require("../../../utils/addresses");

const plumeFixture = createFixtureLoader(defaultPlumeFixture);

describe("Plume Fork Test: Bridged WOETH Strategy", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await plumeFixture();
  });

  it("Should allow governor/strategist to mint with bridged WOETH", async () => {
    const { woeth, oethp, oethpVault, weth, woethStrategy, governor } = fixture;

    await oethpVault.rebase();

    const supplyBefore = await oethp.totalSupply();
    const userOETHpBalanceBefore = await oethp.balanceOf(governor.address);
    const userWOETHBalanceBefore = await woeth.balanceOf(governor.address);
    const stratBalanceBefore = await woethStrategy.checkBalance(weth.address);
    const stratWOETHBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const depositAmount = oethUnits("1");
    const expectedAmount = await woethStrategy.getBridgedWOETHValue(
      depositAmount
    );

    // Governor mints OETHp with wOETH
    await woeth.connect(governor).approve(woethStrategy.address, depositAmount);
    await woethStrategy.connect(governor).depositBridgedWOETH(depositAmount);

    const supplyDiff = (await oethp.totalSupply()).sub(supplyBefore);
    expect(supplyDiff).to.approxEqualTolerance(
      expectedAmount,
      1,
      "Incorrect supply change"
    );

    const userOETHpBalanceDiff = (await oethp.balanceOf(governor.address)).sub(
      userOETHpBalanceBefore
    );
    expect(userOETHpBalanceDiff).to.approxEqualTolerance(
      expectedAmount,
      1,
      "OETHp balance didn't increase"
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
    const { woeth, oethp, oethpVault, weth, woethStrategy, governor } = fixture;

    await oethpVault.rebase();
    await woethStrategy.updateWOETHOraclePrice();

    const depositWOETHAmount = oethUnits("1");

    // Governor mints OETHp with wOETH
    await woeth
      .connect(governor)
      .approve(woethStrategy.address, depositWOETHAmount);
    await woethStrategy
      .connect(governor)
      .depositBridgedWOETH(depositWOETHAmount);

    const supplyBefore = await oethp.totalSupply();
    const userOETHpBalanceBefore = await oethp.balanceOf(governor.address);
    const userWOETHBalanceBefore = await woeth.balanceOf(governor.address);
    const stratBalanceBefore = await woethStrategy.checkBalance(weth.address);
    const stratWOETHBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const expectedOETHpAmount = await woethStrategy.getBridgedWOETHValue(
      depositWOETHAmount.sub(1)
    );

    // Approve strategy to move OETHp
    await oethp
      .connect(governor)
      .approve(woethStrategy.address, oethUnits("1000000"));

    // Governor tries to withdraw
    await woethStrategy
      .connect(governor)
      .withdrawBridgedWOETH(expectedOETHpAmount);

    const supplyDiff = supplyBefore.sub(await oethp.totalSupply());
    expect(supplyDiff).to.approxEqualTolerance(
      expectedOETHpAmount,
      1,
      "Incorrect supply change"
    );

    const userOETHpBalanceDiff = userOETHpBalanceBefore.sub(
      await oethp.balanceOf(governor.address)
    );
    expect(userOETHpBalanceDiff).to.approxEqualTolerance(
      expectedOETHpAmount,
      1,
      "OETHp balance didn't go down"
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
      expectedOETHpAmount,
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
    const { woeth, oethp, oethpVault, weth, woethStrategy, governor } = fixture;

    await oethpVault.rebase();

    const depositAmount = oethUnits("1");
    const oracleFeed = await ethers.getContractAt(
      "AggregatorV3Interface",
      addresses.base.BridgedWOETHOracleFeed
    );
    const roundData = await oracleFeed.latestRoundData();

    // Governor mints OETHp with wOETH
    await woeth.connect(governor).approve(woethStrategy.address, depositAmount);
    await woethStrategy.connect(governor).depositBridgedWOETH(depositAmount);

    const supplyBefore = await oethp.totalSupply();
    // const userOETHpBalanceBefore = await oethp.balanceOf(governor.address);
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
    await oethpVault.rebase();

    // Should've increased supply
    expect(await oethp.totalSupply()).to.be.approxEqualTolerance(
      supplyBefore.add(stratBalanceBefore.mul(5).div(1000)),
      1
    );
  });
});
