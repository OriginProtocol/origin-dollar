const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { oethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  defaultFixtureSetup,
  convexOETHMetaVaultFixtureSetup,
} = require("../_fixture");
const { logCurvePool } = require("../../utils/curve");

const log = require("../../utils/logger")("test:fork:oeth:metapool");

const convexOETHMetaVaultFixture = convexOETHMetaVaultFixtureSetup();

forkOnlyDescribe("ForkTest: OETH AMO Curve Metapool Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await convexOETHMetaVaultFixture();
  });
  after(async () => {
    // This is needed to revert fixtures
    // The other tests as of now don't use proper fixtures
    // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
    const f = defaultFixtureSetup();
    await f();
  });

  it("Should have constants and immutables set", async () => {
    const { convexEthMetaStrategy } = fixture;

    expect(await convexEthMetaStrategy.MAX_SLIPPAGE()).to.equal(
      parseUnits("0.01", 18)
    );
    expect(await convexEthMetaStrategy.ETH_ADDRESS()).to.equal(addresses.ETH);

    expect(await convexEthMetaStrategy.cvxDepositorAddress()).to.equal(
      addresses.mainnet.CVXBooster
    );
    expect(await convexEthMetaStrategy.cvxRewardStaker()).to.equal(
      addresses.mainnet.CVXETHRewardsPool
    );
    expect(await convexEthMetaStrategy.cvxDepositorPTokenId()).to.equal(
      oethPoolLpPID
    );
    expect(await convexEthMetaStrategy.curvePool()).to.equal(
      addresses.mainnet.CurveOETHMetaPool
    );
    expect(await convexEthMetaStrategy.lpToken()).to.equal(
      addresses.mainnet.CurveOETHMetaPool
    );
    expect(await convexEthMetaStrategy.oeth()).to.equal(
      addresses.mainnet.OETHProxy
    );
    expect(await convexEthMetaStrategy.weth()).to.equal(addresses.mainnet.WETH);
  });

  it("Should be able to check balance", async () => {
    const { weth, josh, convexEthMetaStrategy } = fixture;

    const balance = await convexEthMetaStrategy.checkBalance(weth.address);
    log(`check balance ${balance}`);
    expect(balance).gt(0);

    // This uses a transaction to call a view function so the gas usage can be reported.
    const tx = await convexEthMetaStrategy
      .connect(josh)
      .populateTransaction.checkBalance(weth.address);
    await josh.sendTransaction(tx);
  });

  it("Strategist should deposit to Metapool", async function () {
    const { josh, weth } = fixture;

    await mintTest(fixture, josh, weth, "5000");
  });

  describe("withdraw", async function () {
    beforeEach(async () => {
      const { convexEthMetaStrategy, oethVault, weth, josh, strategist } =
        fixture;

      await oethVault.connect(josh).allocate();
      const unitAmount = oethUnits("10");

      await weth.connect(josh).approve(oethVault.address, unitAmount);
      await oethVault.connect(josh).mint(weth.address, unitAmount, 0);
      await oethVault
        .connect(strategist)
        .depositToStrategy(
          convexEthMetaStrategy.address,
          [weth.address],
          [unitAmount]
        );
    });
    it("Should be able to withdraw all", async () => {
      const { convexEthMetaStrategy, oeth, vaultSigner } = fixture;

      const oethSupplyBefore = await oeth.totalSupply();

      // Now try to withdraw all the WETH from the strategy
      await convexEthMetaStrategy.connect(vaultSigner).withdrawAll();

      const oethSupplyAfter = await oeth.totalSupply();
      const oethSupplyDiff = oethSupplyBefore.sub(oethSupplyAfter);

      expect(oethSupplyDiff).to.be.gte(oethUnits("9.95"));
    });

    it("Should be able to withdraw some", async () => {
      const {
        convexEthMetaStrategy,
        oeth,
        oethMetaPool,
        oethVault,
        vaultSigner,
        weth,
      } = fixture;

      const oethSupplyBefore = await oeth.totalSupply();

      const withdrawAmount = oethUnits("9");

      await logCurvePool(oethMetaPool, "ETH ", "OETH");

      // Now try to withdraw the WETH from the strategy
      await convexEthMetaStrategy
        .connect(vaultSigner)
        .withdraw(oethVault.address, weth.address, withdrawAmount);

      await logCurvePool(oethMetaPool, "ETH ", "OETH");

      const oethSupplyAfter = await oeth.totalSupply();
      const oethSupplyDiff = oethSupplyBefore.sub(oethSupplyAfter);

      expect(oethSupplyDiff).to.be.gte(oethUnits("8.95"));
    });
  });

  it("Should be able to harvest the rewards", async function () {
    const {
      josh,
      weth,
      oethHarvester,
      oethDripper,
      oethVault,
      convexEthMetaStrategy,
      crv,
    } = fixture;
    await mintTest(fixture, josh, weth, "5");

    // send some CRV to the strategy to partly simulate reward harvesting
    await crv
      .connect(josh)
      .transfer(convexEthMetaStrategy.address, oethUnits("1000"));

    const wethBefore = await weth.balanceOf(oethDripper.address);

    // prettier-ignore
    await oethHarvester
      .connect(josh)["harvestAndSwap(address)"](convexEthMetaStrategy.address);

    const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
      wethBefore
    );
    await oethVault.connect(josh).rebase();

    await expect(wethDiff).to.be.gte(oethUnits("0.3"));
  });
});

async function mintTest(fixture, user, asset, amount = "3") {
  const {
    strategist,
    oethVault,
    oeth,
    convexEthMetaStrategy,
    cvxRewardPool,
    oethMetaPool,
    weth,
  } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);

  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(convexEthMetaStrategy.address);

  await logCurvePool(oethMetaPool, "ETH ", "OETH");

  // Mint OUSD w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault
    .connect(strategist)
    .depositToStrategy(
      convexEthMetaStrategy.address,
      [weth.address],
      [unitAmount]
    );

  await logCurvePool(oethMetaPool, "ETH ", "OETH");

  // Ensure user has correct balance (w/ 1% slippage tolerance)
  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const balanceDiff = newBalance.sub(currentBalance);
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 1);

  // Supply checks
  const newSupply = await oeth.totalSupply();
  const supplyDiff = newSupply.sub(currentSupply);

  expect(supplyDiff).to.approxEqualTolerance(oethUnits(amount).mul(2), 5);

  //Ensure some LP tokens got staked under OUSDMetaStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(convexEthMetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );

  // multiplied by 2 because the strategy prints corresponding amount of OETH and
  // deploys it in the pool
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
    oethUnits(amount).mul(2),
    1
  );
}
