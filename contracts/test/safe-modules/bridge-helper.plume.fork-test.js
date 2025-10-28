const { createFixtureLoader } = require("../_fixture");
const { bridgeHelperModuleFixture } = require("../_fixture-plume");
const { oethUnits } = require("../helpers");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");

const plumeFixture = createFixtureLoader(bridgeHelperModuleFixture);

describe("ForkTest: Bridge Helper Safe Module (Plume)", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await plumeFixture();
  });

  it("Should bridge wOETH to Ethereum", async () => {
    const { woeth, governor, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 wOETH
    await woeth.connect(governor).mint(safeSigner.address, oethUnits("1"));

    const balanceBefore = await woeth.balanceOf(safeSigner.address);

    // Bridge 1 wOETH to Ethereum
    const tx = await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWOETHToEthereum(
        oethUnits("1"),
        50 // 0.5% slippage
      );

    // Check balance
    const balanceAfter = await woeth.balanceOf(safeSigner.address);
    expect(balanceAfter).to.eq(balanceBefore.sub(oethUnits("1")));

    // Check events
    const { events } = await tx.wait();

    const lzBridgeEvent = events.find(
      (e) =>
        e.address.toLowerCase() ===
        addresses.plume.WOETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30101");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.eq(oethUnits("1"));
  });

  it("Should bridge WETH to Ethereum", async () => {
    const { _mintWETH, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 WETH
    await _mintWETH(safeSigner, oethUnits("1"));

    // Bridge 1 WETH to Ethereum
    const tx = await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWETHToEthereum(
        oethUnits("1"),
        100 // 1% slippage
      );

    const { events } = await tx.wait();

    const lzBridgeEvent = events.find(
      (e) =>
        e.address.toLowerCase() ===
        addresses.plume.WETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30101");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.gt(oethUnits("0.99"));
  });

  // Skipping since minting is disabled
  it.skip("Should deposit wOETH for OETHp and redeem it for WETH", async () => {
    const {
      _mintWETH,
      oethpVault,
      woeth,
      weth,
      oethp,
      governor,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    // Make sure Vault has some WETH
    _mintWETH(governor, oethUnits("1"));
    await weth.connect(governor).approve(oethpVault.address, oethUnits("1"));
    await oethpVault.connect(governor).mint(weth.address, oethUnits("1"), "0");

    // Update oracle price
    await woethStrategy.updateWOETHOraclePrice();
    await oethpVault.rebase();

    const woethAmount = oethUnits("1");
    const expectedWETH = await woethStrategy.getBridgedWOETHValue(woethAmount);

    // Mint 1 wOETH
    await woeth.connect(governor).mint(safeSigner.address, woethAmount);

    const supplyBefore = await oethp.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Deposit 1 wOETH for OETHp and redeem it for WETH
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWOETH(oethUnits("1"), true);

    const supplyAfter = await oethp.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    const woethBalanceAfter = await woeth.balanceOf(safeSigner.address);
    const woethStrategyBalanceAfter = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueAfter = await woethStrategy.checkBalance(
      weth.address
    );

    // because we redeem with vault, the OETHp minted in the process also gets redeemed
    expect(supplyAfter).to.gte(supplyBefore);
    // weth has been gained as it was redeemed using the vault
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

  // Skipping since minting is disabled
  it.skip("Should deposit wOETH for OETHp and not redeem it for WETH", async () => {
    const {
      _mintWETH,
      oethpVault,
      woeth,
      weth,
      oethp,
      governor,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    // Make sure Vault has some WETH
    _mintWETH(governor, oethUnits("1"));
    await weth.connect(governor).approve(oethpVault.address, oethUnits("1.1"));

    // Update oracle price
    await oethpVault.rebase();
    await woethStrategy.updateWOETHOraclePrice();

    await oethpVault
      .connect(governor)
      .mint(weth.address, oethUnits("1.1"), "0");
    const woethAmount = oethUnits("1");
    const expectedWETH = await woethStrategy.getBridgedWOETHValue(woethAmount);

    // Mint 1 wOETH
    await woeth.connect(governor).mint(safeSigner.address, woethAmount);

    const supplyBefore = await oethp.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Deposit 1 wOETH for OETHp and redeem it for WETH
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWOETH(oethUnits("1"), false);

    const supplyAfter = await oethp.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    const woethBalanceAfter = await woeth.balanceOf(safeSigner.address);
    const woethStrategyBalanceAfter = await woeth.balanceOf(
      woethStrategy.address
    );
    const woethStrategyValueAfter = await woethStrategy.checkBalance(
      weth.address
    );

    // because we redeem with vault, the OETHp minted in the process also gets redeemed
    expect(supplyAfter).to.gte(supplyBefore.add(oethUnits("1")));
    // no weth has been gained because it was not redeemed with vault
    expect(wethBalanceAfter).to.approxEqualTolerance(wethBalanceBefore);

    expect(woethBalanceAfter).to.eq(woethBalanceBefore.sub(woethAmount));
    expect(woethStrategyBalanceAfter).to.eq(
      woethStrategyBalanceBefore.add(woethAmount)
    );
    expect(woethStrategyValueAfter).to.approxEqualTolerance(
      woethStrategyValueBefore.add(expectedWETH)
    );
  });

  it("Should mint OETHp with WETH and redeem it for wOETH", async () => {
    const {
      _mintWETH,
      oethpVault,
      woeth,
      weth,
      oethp,
      safeSigner,
      woethStrategy,
      bridgeHelperModule,
    } = fixture;

    const wethAmount = oethUnits("1");

    await _mintWETH(safeSigner, wethAmount);

    // Update oracle price
    await woethStrategy.updateWOETHOraclePrice();
    await oethpVault.rebase();

    const wethPerUnitWOETH = await woethStrategy.getBridgedWOETHValue(
      oethUnits("1")
    );
    const expectedWOETHAmount = wethAmount
      .mul(oethUnits("1"))
      .div(wethPerUnitWOETH);

    const supplyBefore = await oethp.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    const woethStrategyBalanceBefore = await woeth.balanceOf(
      woethStrategy.address
    );

    const woethStrategyValueBefore = await woethStrategy.checkBalance(
      weth.address
    );

    // Deposit 1 WETH for OETHp and redeem it for wOETH
    await bridgeHelperModule
      .connect(safeSigner)
      .depositWETHAndRedeemWOETH(wethAmount);

    const supplyAfter = await oethp.totalSupply();
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
