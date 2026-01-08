const { createFixtureLoader } = require("../_fixture");
const { bridgeHelperModuleFixture } = require("../_fixture-base");
const { oethUnits } = require("../helpers");
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

  it.skip("Should deposit wOETH for OETHb and redeem it for WETH", async () => {
    const {
      nick,
      _mintWETH,
      oethbVault,
      woeth,
      weth,
      oethb,
      minter,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    // Make sure Vault has some WETH
    _mintWETH(nick, "10000");
    await weth.connect(nick).approve(oethbVault.address, oethUnits("10000"));
    await oethbVault.connect(nick).mint(weth.address, oethUnits("10000"), "0");

    // Update oracle price
    await woethStrategy.updateWOETHOraclePrice();
    await oethbVault.rebase();

    const woethAmount = oethUnits("1");
    const expectedWETH = await woethStrategy.getBridgedWOETHValue(woethAmount);

    // Mint 1 wOETH
    await woeth.connect(minter).mint(safeSigner.address, woethAmount);

    const supplyBefore = await oethb.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Deposit 1 wOETH for OETHb and redeem it for WETH
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWOETH(oethUnits("1"), true);

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
      supplyBefore.add(oethUnits("1"))
    );
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(expectedWETH)
    );
    expect(woethBalanceAfter).to.eq(woethBalanceBefore.sub(woethAmount));
    expect(woethStrategyBalanceAfter).to.eq(
      woethStrategyBalanceBefore.add(woethAmount)
    );
    expect(woethStrategyValueAfter).to.approxEqualTolerance(
      woethStrategyValueBefore.add(expectedWETH)
    );
  });

  it.skip("Should mint OETHb with WETH and redeem it for wOETH", async () => {
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
