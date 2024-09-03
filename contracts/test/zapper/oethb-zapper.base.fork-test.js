const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb Zapper", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should mint OETHb with ETH", async () => {
    const { clement, zapper, oethb } = fixture;

    const supplyBefore = await oethb.totalSupply();
    const balanceBefore = await hre.ethers.provider.getBalance(clement.address);

    const tx = await zapper.connect(clement).deposit({
      value: oethUnits("1"),
    });

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oethb.totalSupply();
    const balanceAfter = await hre.ethers.provider.getBalance(clement.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(balanceAfter).to.approxEqualTolerance(
      balanceBefore.sub(oethUnits("1")),
      2
    );
  });

  it("Should mint wsuperOETHb with ETH", async () => {
    const { clement, zapper, oethb, wOETHb } = fixture;

    const supplyBefore = await oethb.totalSupply();
    const ethBalanceBefore = await hre.ethers.provider.getBalance(
      clement.address
    );
    const woethbBalanceBefore = await wOETHb.balanceOf(clement.address);

    const expected = await wOETHb.previewDeposit(oethUnits("1"));

    const tx = await zapper.connect(clement).depositETHForWrappedTokens("0", {
      value: oethUnits("1"),
    });

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oethb.totalSupply();
    const ethBalanceAfter = await hre.ethers.provider.getBalance(
      clement.address
    );
    const woethbBalanceAfter = await wOETHb.balanceOf(clement.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(ethBalanceAfter).to.approxEqualTolerance(
      ethBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(woethbBalanceAfter).to.approxEqualTolerance(
      woethbBalanceBefore.add(expected),
      2
    );
  });

  it("Should mint wsuperOETHb with WETH", async () => {
    const { clement, zapper, oethb, wOETHb, weth } = fixture;

    await weth.connect(clement).deposit({ value: oethUnits("1") });
    await weth.connect(clement).approve(zapper.address, oethUnits("1"));

    const supplyBefore = await oethb.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(clement.address);
    const woethbBalanceBefore = await wOETHb.balanceOf(clement.address);

    const expected = await wOETHb.previewDeposit(oethUnits("1"));

    const tx = await zapper
      .connect(clement)
      .depositWETHForWrappedTokens(oethUnits("1"), "0");

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oethb.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(clement.address);
    const woethbBalanceAfter = await wOETHb.balanceOf(clement.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(woethbBalanceAfter).to.approxEqualTolerance(
      woethbBalanceBefore.add(expected),
      2
    );
  });
});
