const { loadDefaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

describe("ForkTest: OETH Zapper", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should mint OETH with ETH", async () => {
    const { domen, oethZapper, oeth } = fixture;

    const supplyBefore = await oeth.totalSupply();
    const balanceBefore = await hre.ethers.provider.getBalance(domen.address);

    const tx = await oethZapper.connect(domen).deposit({
      value: oethUnits("1"),
    });

    await expect(tx).to.emit(oethZapper, "Zap");

    const supplyAfter = await oeth.totalSupply();
    const balanceAfter = await hre.ethers.provider.getBalance(domen.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(balanceAfter).to.approxEqualTolerance(
      balanceBefore.sub(oethUnits("1")),
      2
    );
  });

  it("Should mint wOETH with ETH", async () => {
    const { domen, oethZapper, oeth, woeth } = fixture;

    const supplyBefore = await oeth.totalSupply();
    const ethBalanceBefore = await hre.ethers.provider.getBalance(
      domen.address
    );
    const woethBalanceBefore = await woeth.balanceOf(domen.address);

    const expected = await woeth.previewDeposit(oethUnits("1"));

    const tx = await oethZapper
      .connect(domen)
      .depositETHForWrappedTokens("0", {
        value: oethUnits("1"),
      });

    await expect(tx).to.emit(oethZapper, "Zap");

    const supplyAfter = await oeth.totalSupply();
    const ethBalanceAfter = await hre.ethers.provider.getBalance(
      domen.address
    );
    const woethBalanceAfter = await woeth.balanceOf(domen.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(ethBalanceAfter).to.approxEqualTolerance(
      ethBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(woethBalanceAfter).to.approxEqualTolerance(
      woethBalanceBefore.add(expected),
      2
    );
  });

  it("Should mint wOETH with WETH", async () => {
    const { domen, oethZapper, oeth, woeth, weth } = fixture;

    await weth.connect(domen).deposit({ value: oethUnits("1") });
    await weth.connect(domen).approve(oethZapper.address, oethUnits("1"));

    const supplyBefore = await oeth.totalSupply();
    const wethBalanceBefore = await weth.balanceOf(domen.address);
    const woethBalanceBefore = await woeth.balanceOf(domen.address);

    const expected = await woeth.previewDeposit(oethUnits("1"));

    const tx = await oethZapper
      .connect(domen)
      .depositWETHForWrappedTokens(oethUnits("1"), "0");

    await expect(tx).to.emit(oethZapper, "Zap");

    const supplyAfter = await oeth.totalSupply();
    const wethBalanceAfter = await weth.balanceOf(domen.address);
    const woethBalanceAfter = await woeth.balanceOf(domen.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(wethBalanceAfter).to.approxEqualTolerance(
      wethBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(woethBalanceAfter).to.approxEqualTolerance(
      woethBalanceBefore.add(expected),
      2
    );
  });
});
