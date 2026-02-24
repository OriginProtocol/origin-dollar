const {
  createFixtureLoader,
  bridgeHelperModuleFixture,
} = require("../_fixture");
const { oethUnits } = require("../helpers");
const { expect } = require("chai");

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
    await oethVault.connect(user).mint(amount);
  };

  const _mintWOETH = async (amount, user, receiver) => {
    // TODO get exchange rate and mint correct amount
    const oethAmount = amount.add(amount);
    await _mintOETH(oethAmount, user);
    await oeth.connect(user).approve(woeth.address, oethAmount);
    await woeth.connect(user).mint(amount, receiver);
  };

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
});
