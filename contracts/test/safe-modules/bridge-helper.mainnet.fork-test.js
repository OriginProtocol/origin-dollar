const {
  createFixtureLoader,
  bridgeHelperModuleFixture,
} = require("../_fixture");
const { oethUnits } = require("../helpers");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");

const mainnetFixture = createFixtureLoader(bridgeHelperModuleFixture);

describe("ForkTest: Bridge Helper Safe Module (Ethereum)", function () {
  let fixture, oethVault, weth, woeth, oeth;
  beforeEach(async () => {
    fixture = await mainnetFixture();
    oethVault = fixture.oethVault;
    weth = fixture.weth;
    woeth = fixture.woeth;
    oeth = fixture.oeth;
  });

  const _mintOETH = async (amount, user) => {
    await weth.connect(user).approve(oethVault.address, amount);
    await oethVault.connect(user).mint(weth.address, amount, amount);
  };

  const _mintWOETH = async (amount, user, receiver) => {
    // TODO get exchange rate and mint correct amount
    const oethAmount = amount.add(amount);
    await _mintOETH(oethAmount, user);
    await oeth.connect(user).approve(woeth.address, oethAmount);
    await woeth.connect(user).mint(amount, receiver);
  };

  it("Should bridge wOETH to Plume", async () => {
    const { woeth, josh, safeSigner, bridgeHelperModule } = fixture;

    // Mint 1 wOETH
    await _mintWOETH(oethUnits("1"), josh, safeSigner.address);

    const balanceBefore = await woeth.balanceOf(safeSigner.address);

    // Bridge 1 wOETH to Ethereum
    const tx = await bridgeHelperModule.connect(safeSigner).bridgeWOETHToPlume(
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
        addresses.mainnet.WOETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30370");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.eq(oethUnits("1"));
  });

  it("Should bridge WETH to Plume", async () => {
    const { weth, josh, safeSigner, bridgeHelperModule } = fixture;

    await weth.connect(josh).transfer(safeSigner.address, oethUnits("1.1"));

    // Bridge 1 WETH to Plume
    const tx = await bridgeHelperModule.connect(safeSigner).bridgeWETHToPlume(
      oethUnits("1"),
      100 // 1% slippage
    );

    const { events } = await tx.wait();

    const lzBridgeEvent = events.find(
      (e) =>
        e.address.toLowerCase() ===
        addresses.mainnet.ETHOmnichainAdapter.toLowerCase()
    );

    expect(lzBridgeEvent.topics[2]).to.eq(
      "0x0000000000000000000000004ff1b9d9ba8558f5eafcec096318ea0d8b541971"
    );
    const [endpointId, amountSentLD, minAmountLD] =
      ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        lzBridgeEvent.data
      );
    expect(endpointId).to.eq("30370");
    expect(amountSentLD).to.eq(oethUnits("1"));
    expect(minAmountLD).to.gt(oethUnits("0.99"));
  });

  it("Should bridge wOETH to Base", async () => {
    const { woeth, josh, safeSigner, bridgeHelperModule } = fixture;

    await _mintWOETH(oethUnits("1"), josh, safeSigner.address);

    const balanceBefore = await woeth.balanceOf(safeSigner.address);

    await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWOETHToBase(oethUnits("1"));

    const balanceAfter = await woeth.balanceOf(safeSigner.address);

    expect(balanceAfter).to.eq(balanceBefore.sub(oethUnits("1")));
  });

  it("Should bridge WETH to Base", async () => {
    const { weth, josh, safeSigner, bridgeHelperModule } = fixture;

    await weth.connect(josh).transfer(safeSigner.address, oethUnits("1.1"));

    const balanceBefore = await weth.balanceOf(safeSigner.address);

    await bridgeHelperModule
      .connect(safeSigner)
      .bridgeWETHToBase(oethUnits("1"));

    const balanceAfter = await weth.balanceOf(safeSigner.address);

    expect(balanceAfter).to.eq(balanceBefore.sub(oethUnits("1")));
  });

  it("Should mint OETH wrap it to WOETH", async () => {
    const {
      josh,
      oethVault,
      woeth,
      weth,
      oeth,
      safeSigner,

      bridgeHelperModule,
    } = fixture;

    await oethVault.connect(josh).rebase();

    await weth.connect(josh).transfer(safeSigner.address, oethUnits("1.1"));

    const wethAmount = oethUnits("1");
    const woethAmount = await woeth.convertToShares(wethAmount);

    const supplyBefore = await oeth.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethSupplyBefore = await woeth.totalSupply();

    // Mint OETH using WETH and wrap it to WOETH
    await bridgeHelperModule
      .connect(safeSigner)
      .mintAndWrap(oethUnits("1"), false);

    const supplyAfter = await oeth.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    const woethSupplyAfter = await woeth.totalSupply();

    expect(supplyAfter).to.gte(supplyBefore.add(wethAmount));
    expect(wethBalanceBefore).to.approxEqualTolerance(
      wethBalanceAfter.add(wethAmount)
    );

    expect(woethSupplyAfter).to.approxEqualTolerance(
      woethSupplyBefore.add(woethAmount)
    );
  });

  it("Should unwrap WOETH and redeem it to WETH", async () => {
    const { woeth, weth, josh, safeSigner, bridgeHelperModule, oethVault } =
      fixture;

    await oethVault.connect(josh).rebase();

    // Do a huge yield deposit to fund the Vault
    await impersonateAndFund(josh.address, "10000");
    await weth.connect(josh).deposit({ value: oethUnits("9500") });
    await weth.connect(josh).approve(oethVault.address, oethUnits("9500"));
    await oethVault.connect(josh).mint(weth.address, oethUnits("9000"), "0");

    const woethAmount = oethUnits("1");

    // Make sure Safe has some wOETH
    await _mintWOETH(woethAmount, josh, safeSigner.address);

    const wethExpected = await woeth.previewRedeem(woethAmount);

    const wethBalanceBefore = await weth.balanceOf(safeSigner.address);
    const woethBalanceBefore = await woeth.balanceOf(safeSigner.address);

    await bridgeHelperModule.connect(safeSigner).unwrapAndRedeem(woethAmount);

    const wethBalanceAfter = await weth.balanceOf(safeSigner.address);
    const woethBalanceAfter = await woeth.balanceOf(safeSigner.address);

    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.add(wethExpected)
    );
    expect(woethBalanceAfter).to.eq(woethBalanceBefore.sub(woethAmount));
  });
});
