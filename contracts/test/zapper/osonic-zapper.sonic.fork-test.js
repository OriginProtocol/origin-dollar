const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Origin Sonic Zapper", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should mint Origin Sonic with S transfer", async () => {
    const { clement, zapper, oSonic } = fixture;

    const supplyBefore = await oSonic.totalSupply();
    const balanceBefore = await hre.ethers.provider.getBalance(clement.address);

    // Transfer 1 S to the zapper
    const tx = await clement.sendTransaction({
      value: oethUnits("1"),
      to: zapper.address,
    });

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oSonic.totalSupply();
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

  it("Should mint Origin Sonic with S using deposit", async () => {
    const { clement, zapper, oSonic } = fixture;

    const supplyBefore = await oSonic.totalSupply();
    const balanceBefore = await hre.ethers.provider.getBalance(clement.address);

    const tx = await zapper.connect(clement).deposit({
      value: oethUnits("1"),
    });

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oSonic.totalSupply();
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

  it("Should mint Wrapped Sonic with S", async () => {
    const { clement, zapper, oSonic, wOSonic } = fixture;

    const supplyBefore = await oSonic.totalSupply();
    const ethBalanceBefore = await hre.ethers.provider.getBalance(
      clement.address
    );
    const wOSonicBalanceBefore = await wOSonic.balanceOf(clement.address);

    const expected = await wOSonic.previewDeposit(oethUnits("1"));

    const tx = await zapper.connect(clement).depositSForWrappedTokens("0", {
      value: oethUnits("1"),
    });

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oSonic.totalSupply();
    const ethBalanceAfter = await hre.ethers.provider.getBalance(
      clement.address
    );
    const wOSonicBalanceAfter = await wOSonic.balanceOf(clement.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(ethBalanceAfter).to.approxEqualTolerance(
      ethBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(wOSonicBalanceAfter).to.approxEqualTolerance(
      wOSonicBalanceBefore.add(expected),
      2
    );
  });

  it("Should mint Wrapped Origin Sonic with Wrapped S", async () => {
    const { clement, zapper, oSonic, wOSonic, wS } = fixture;

    await wS.connect(clement).deposit({ value: oethUnits("1") });
    await wS.connect(clement).approve(zapper.address, oethUnits("1"));

    const supplyBefore = await oSonic.totalSupply();
    const wSBalanceBefore = await wS.balanceOf(clement.address);
    const wOSonicBalanceBefore = await wOSonic.balanceOf(clement.address);

    const expected = await wOSonic.previewDeposit(oethUnits("1"));

    const tx = await zapper
      .connect(clement)
      .depositWSForWrappedTokens(oethUnits("1"), "0");

    await expect(tx).to.emit(zapper, "Zap");

    const supplyAfter = await oSonic.totalSupply();
    const wSBalanceAfter = await wS.balanceOf(clement.address);
    const wOSonicBalanceAfter = await wOSonic.balanceOf(clement.address);

    expect(supplyAfter).to.approxEqualTolerance(
      supplyBefore.add(oethUnits("1")),
      2
    );
    expect(wSBalanceAfter).to.approxEqualTolerance(
      wSBalanceBefore.sub(oethUnits("1")),
      2
    );
    expect(wOSonicBalanceAfter).to.approxEqualTolerance(
      wOSonicBalanceBefore.add(expected),
      2
    );
  });
});
