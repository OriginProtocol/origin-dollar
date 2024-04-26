const { expect } = require("chai");
const { utils } = require("ethers");
const addresses = require("../../utils/addresses");
const { units, oethUnits } = require("../helpers");

const {
  loadSimpleOETHFixture,
} = require("./../_fixture");

describe("Holesky ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  // this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadSimpleOETHFixture();
  });

  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { nativeStakingSSVStrategy } = fixture;
      await expect(
        await nativeStakingSSVStrategy.WETH_TOKEN_ADDRESS()
      ).to.equal(addresses.holesky.WETH, "Incorrect WETH address set");
      await expect(await nativeStakingSSVStrategy.SSV_TOKEN_ADDRESS()).to.equal(
        addresses.holesky.SSV,
        "Incorrect SSV Token address"
      );
      await expect(
        await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS()
      ).to.equal(addresses.holesky.SSVNetwork, "Incorrect SSV Network address");
    });

    it("Should check that the fuse interval is configured correctly", async () => {
      const { nativeStakingSSVStrategy } = fixture;

      await expect(utils.parseEther("21.6")).to.equal(await nativeStakingSSVStrategy.fuseIntervalStart());
      await expect(utils.parseEther("25.6")).to.equal(await nativeStakingSSVStrategy.fuseIntervalEnd());
    });
  });

  describe("Deposit/Allocation", function () {
    it.only("Should mint using WETH", async () => {
      const { nativeStakingSSVStrategy, josh, weth } = fixture;
      await mintTest(fixture, josh, weth);
    });
  });

  describe("Withdraw", function () {});

  describe("Balance/Assets", function () {});
});

async function mintTest(fixture, user, asset, amount = "32") {
  const { oethVault, oeth, weth, nativeStakingSSVStrategy } = fixture;

  const unitAmount = await units(amount, asset);

  if (asset.address != weth.address) {
    const tx = oethVault.connect(user).mint(asset.address, unitAmount, "0");
    await expect(tx).to.be.revertedWith("Unsupported asset for minting");
    return;
  }

  await oethVault.connect(user).allocate();
  await oethVault.connect(user).rebase();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentStrategyBalance = await nativeStakingSSVStrategy.checkBalance(
    weth.address
  );

  // Mint OETH w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newStrategyBalance = await nativeStakingSSVStrategy.checkBalance(weth.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const oethUnitAmount = oethUnits(amount);
  expect(supplyDiff).to.approxEqualTolerance(oethUnitAmount, 1);

  expect(unitAmount).to.equal(newStrategyBalance.sub(currentStrategyBalance));
}
