const { separateAssetStrategyFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const {
  daiUnits,
  usdtUnits,
  usdcUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("Vault with three strategies using separate assets", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should allocate correctly", async () => {
    const {
      vault,
      dai,
      usdt,
      usdc,
      josh,
      governor,
      compoundStrategy,
      curveUSDTStrategy,
      curveUSDCStrategy,
    } = await loadFixture(separateAssetStrategyFixture);

    await usdc.connect(josh).approve(vault.address, usdcUnits("500"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("500"));
    await usdt.connect(josh).approve(vault.address, usdtUnits("1000"));
    await vault.connect(josh).mint(usdt.address, usdtUnits("1000"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("200")
    );

    expect(await curveUSDTStrategy.checkBalance(usdt.address)).to.equal(
      usdtUnits("1000")
    );

    expect(await curveUSDCStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("500")
    );
  });

  it("Should allocate correctly with a vault buffer set", async () => {
    const {
      vault,
      dai,
      usdt,
      usdc,
      josh,
      governor,
      compoundStrategy,
      curveUSDTStrategy,
      curveUSDCStrategy,
    } = await loadFixture(separateAssetStrategyFixture);

    // Set vault buffer to 10%
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));

    await usdc.connect(josh).approve(vault.address, usdcUnits("500"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("500"));
    await usdt.connect(josh).approve(vault.address, usdtUnits("1000"));
    await vault.connect(josh).mint(usdt.address, usdtUnits("1000"));
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(
      daiUnits("180")
    );

    expect(await curveUSDTStrategy.checkBalance(usdt.address)).to.equal(
      usdtUnits("900")
    );

    expect(await curveUSDCStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("450")
    );
  });
});
