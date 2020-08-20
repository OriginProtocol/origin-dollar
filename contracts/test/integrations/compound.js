const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");

const { isGanacheFork, daiUnits, loadFixture } = require("../helpers");

describe("Compound", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should deposit supported assets into Compound and mint corresponding cToken", async () => {
    const { dai, matt } = await loadFixture(defaultFixture);
    const { governorAddr } = await getNamedAccounts();

    // Add compound as the single strategy on the Vault contract
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    const vaultContract = await ethers.getContract("Vault");
    const vaultContractGovernor = vaultContract.connect(
      ethers.provider.getSigner(governorAddr)
    );

    vaultContractGovernor.addStrategy(compoundStrategy.address, 100);

    // Mint OUSD
    await dai.connect(matt).approve(vaultContract.address, daiUnits("100"));
    await vaultContract
      .connect(matt)
      .depositAndMint(dai.address, daiUnits("100"));

    /* TODO
    const cDAI = await ethers.getContract("MockCDAI");
    const exchangeRateFactor = isGanacheFork ? 1 : (100002 * 10 ** 13) / 1e18;
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

  it("Only Governor can call safeApproveAllTokens", async () => {
    const { matt } = await loadFixture(defaultFixture);
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).safeApproveAllTokens()
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Governor can call setPTokenAddress", async () => {
    const { dai, ousd, matt } = await loadFixture(defaultFixture);
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).setPTokenAddress(ousd.address, dai.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const { matt } = await loadFixture(defaultFixture);
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).collectRewardToken(await matt.getAddress())
    ).to.be.revertedWith("Caller is not the Vault");
  });
});
