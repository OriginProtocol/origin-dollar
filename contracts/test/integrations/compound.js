const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { utils } = require("ethers");
// const bignumber = require("bignumber");

const { isGanacheFork, daiUnits, loadFixture } = require("../helpers");

describe("Compound", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should deposit supported assets into Compound and mint corresponding cToken", async () => {
    const { dai, matt } = await loadFixture(defaultFixture);

    const compoundStrategy = await ethers.getContract("CompoundStrategy");

    // TODO Vault instead of Matt

    // Simulate Vault transferring DAI into strategy
    await dai.connect(matt).transfer(compoundStrategy.address, daiUnits("100"));
    // Simulate Vault calling the deposit method to mint cDAI
    await compoundStrategy.connect(matt).deposit(dai.address, daiUnits("100"));

    /* TODO
    const cDAI = await ethers.getContract("MockCDAI");
    const exchangeRateFactor = isGanacheFork ? 1 : (100002 * 10 ** 13) / 1e18;
    console.log(exchangeRateFactor);
    expect(Number(await cDAI.balanceOf(compoundStrategy.address))).to.equal(
      utils.parseUnits("100", 8) / exchangeRateFactor
    );
    */
  });

  it("Should withdraw previously deposited assets from Compound");

  it(
    "Should correctly calculate the balance of the vault when assets are deposited into Compound"
  );

  it(
    "Should correctly calculate the balance of the vault when assets are withdrawn Compound"
  );

  it("Should claim COMP tokens");

  it("Only governor can call safeApproveAllTokens");

  it("Only governor can call setPTokenAddress");

  it("Only Vault can call collectRewardToken");
});
