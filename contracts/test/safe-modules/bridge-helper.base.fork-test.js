const { createFixtureLoader } = require("../_fixture");
const { bridgeHelperModuleFixture } = require("../_fixture-base");
const { oethUnits, advanceTime } = require("../helpers");
const { expect } = require("chai");

const baseFixture = createFixtureLoader(bridgeHelperModuleFixture);

describe("ForkTest: Bridge Helper Safe Module (Base)", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should bridge wOETH to Ethereum", async () => {
    const { woeth, minter, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 wOETH
    await woeth.connect(minter).mint(safeSigner.address, oethUnits("1"));

    const balanceBefore = await woeth.balanceOf(safeSigner.address);

    // Bridge 1 wOETH to Ethereum
    await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWOETHToEthereum(oethUnits("1"));

    // Check balance
    const balanceAfter = await woeth.balanceOf(safeSigner.address);
    expect(balanceAfter).to.eq(balanceBefore.sub(oethUnits("1")));
  });

  it("Should bridge WETH to Ethereum", async () => {
    const { _mintWETH, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 WETH
    await _mintWETH(safeSigner, "1");

    // Bridge 1 WETH to Ethereum
    await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWETHToEthereum(oethUnits("1"));
  });

  it("Should deposit wOETH for OETHb and async withdraw for WETH", async () => {
    const {
      nick,
      _mintWETH,
      oethbVault,
      woeth,
      weth,
      minter,
      governor,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    // Make sure Vault has some WETH
    await _mintWETH(nick, "10000");
    await weth.connect(nick).approve(oethbVault.address, oethUnits("10000"));
    await oethbVault.connect(nick).mint(oethUnits("10000"));

    // Ensure withdrawal claim delay is set
    let delayPeriod = await oethbVault.withdrawalClaimDelay();
    if (delayPeriod == 0) {
      await oethbVault.connect(governor).setWithdrawalClaimDelay(10 * 60);
      delayPeriod = 10 * 60;
    }

    // Update oracle price
    await woethStrategy.updateWOETHOraclePrice();
    await oethbVault.rebase();

    const woethAmount = oethUnits("1");
    const expectedWETH = await woethStrategy.getBridgedWOETHValue(woethAmount);

    // Mint 1 wOETH
    await woeth.connect(minter).mint(safeSigner.address, woethAmount);

    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Get request ID before the call
    const { nextWithdrawalIndex } = await oethbVault.withdrawalQueueMetadata();

    // Deposit 1 wOETH and request async withdrawal
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWOETHAndRequestWithdrawal(woethAmount);

    // wOETH should be transferred to strategy
    expect(await woeth.balanceOf(safeSigner.address)).to.eq(
      woethBalanceBefore.sub(woethAmount)
    );
    expect(await woeth.balanceOf(woethStrategy.address)).to.eq(
      woethStrategyBalanceBefore.add(woethAmount)
    );
    expect(await woethStrategy.checkBalance(weth.address)).to.approxEqualTolerance(
      woethStrategyValueBefore.add(expectedWETH)
    );

    // WETH shouldn't have changed yet (withdrawal is pending)
    expect(await weth.balanceOf(safeSigner.address)).to.eq(wethBalanceBefore);

    // Advance time past the claim delay
    await advanceTime(delayPeriod + 1);

    // Claim the withdrawal
    await bridgeHelperModule
      .connect(safeSigner)
      .claimWithdrawal(nextWithdrawalIndex);

    // WETH should have increased by the expected amount
    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(expectedWETH)
    );
  });

  it("Should mint OETHb with WETH and redeem it for wOETH", async () => {
    const {
      _mintWETH,
      oethbVault,
      woeth,
      weth,
      oethb,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    const wethAmount = oethUnits("1");

    await _mintWETH(safeSigner, "1");

    // Update oracle price
    await woethStrategy.updateWOETHOraclePrice();
    await oethbVault.rebase();

    const wethPerUnitWOETH = await woethStrategy.getBridgedWOETHValue(
      oethUnits("1")
    );
    const expectedWOETHAmount = wethAmount
      .mul(oethUnits("1"))
      .div(wethPerUnitWOETH);

    const supplyBefore = await oethb.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Deposit 1 WETH for OETHb and redeem it for wOETH
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWETHAndRedeemWOETH(wethAmount);

    const supplyAfter = await oethb.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    const woethBalanceAfter = await woeth.balanceOf(safeSigner.address);
    const woethStrategyBalanceAfter = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueAfter = await woethStrategy.checkBalance(
      weth.address
    );

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.sub(oethUnits("1"))
    );
    expect(wethBalanceAfter).to.eq(wethBalanceBefore.sub(wethAmount));
    expect(woethBalanceAfter).to.eq(
      woethBalanceBefore.add(expectedWOETHAmount)
    );
    expect(woethStrategyBalanceAfter).to.approxEqualTolerance(
      woethStrategyBalanceBefore.sub(expectedWOETHAmount)
    );
    expect(woethStrategyValueAfter).to.approxEqualTolerance(
      woethStrategyValueBefore.sub(expectedWOETHAmount)
    );
  });
});
