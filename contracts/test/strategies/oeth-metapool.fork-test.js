const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");

const { units, oethUnits, forkOnlyDescribe, isCI } = require("../helpers");
const {
  createFixtureLoader,
  convexOETHMetaVaultFixture,
  impersonateAndFundContract,
} = require("../_fixture");
const { logCurvePool } = require("../../utils/curve");

const log = require("../../utils/logger")("test:fork:oeth:metapool");

forkOnlyDescribe("ForkTest: OETH AMO Curve Metapool Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(convexOETHMetaVaultFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should deposit to Metapool", async function () {
    // TODO: should have differently balanced metapools
    const { josh, weth } = fixture;

    await mintTest(fixture, josh, weth, "5000");
  });

  it("Should be able to withdraw all", async () => {
    const { oethVault, oeth, weth, josh, ConvexEthMetaStrategy } = fixture;

    await oethVault.connect(josh).allocate();
    const supplyBeforeMint = await oeth.totalSupply();
    const amount = "10";
    const unitAmount = oethUnits(amount);

    await weth.connect(josh).approve(oethVault.address, unitAmount);
    await oethVault.connect(josh).mint(weth.address, unitAmount, 0);
    await oethVault.connect(josh).allocate();

    // mul by 2 because the other 50% is represented by the OETH balance
    const strategyBalance = (
      await ConvexEthMetaStrategy.checkBalance(weth.address)
    ).mul(2);

    // 10 WETH + 10 (printed) OETH
    await expect(strategyBalance).to.be.gte(oethUnits("20"));

    const currentSupply = await oeth.totalSupply();
    const supplyAdded = currentSupply.sub(supplyBeforeMint);
    // 10 OETH to josh for minting. And 10 printed into the strategy
    expect(supplyAdded).to.be.gte(oethUnits("19.98"));

    const vaultSigner = await impersonateAndFundContract(oethVault.address);
    // Now try to redeem the amount
    await ConvexEthMetaStrategy.connect(vaultSigner).withdrawAll();

    const newSupply = await oeth.totalSupply();
    const supplyDiff = currentSupply.sub(newSupply);

    expect(supplyDiff).to.be.gte(oethUnits("9.95"));
  });

  it("Should redeem", async () => {
    const { oethVault, oeth, weth, josh, ConvexEthMetaStrategy } = fixture;

    await oethVault.connect(josh).allocate();
    const supplyBeforeMint = await oeth.totalSupply();
    const amount = "10";
    const unitAmount = oethUnits(amount);

    await weth.connect(josh).approve(oethVault.address, unitAmount);
    await oethVault.connect(josh).mint(weth.address, unitAmount, 0);
    await oethVault.connect(josh).allocate();

    // mul by 2 because the other 50% is represented by the OETH balance
    const strategyBalance = (
      await ConvexEthMetaStrategy.checkBalance(weth.address)
    ).mul(2);

    // 10 WETH + 10 (printed) OETH
    await expect(strategyBalance).to.be.gte(oethUnits("20"));

    const currentSupply = await oeth.totalSupply();
    const supplyAdded = currentSupply.sub(supplyBeforeMint);
    // 10 OETH to josh for minting. And 10 printed into the strategy
    expect(supplyAdded).to.be.gte(oethUnits("19.98"));

    const currentBalance = await oeth.connect(josh).balanceOf(josh.address);

    // Now try to redeem the amount
    await oethVault.connect(josh).redeem(oethUnits("8"), 0);

    // User balance should be down by 8 eth
    const newBalance = await oeth.connect(josh).balanceOf(josh.address);
    expect(newBalance).to.approxEqualTolerance(
      currentBalance.sub(oethUnits("8")),
      1
    );

    const newSupply = await oeth.totalSupply();
    const supplyDiff = currentSupply.sub(newSupply);

    expect(supplyDiff).to.be.gte(oethUnits("7.95"));
  });

  it("Should be able to harvest the rewards", async function () {
    const {
      josh,
      weth,
      oethHarvester,
      oethDripper,
      oethVault,
      ConvexEthMetaStrategy,
      crv,
    } = fixture;
    await mintTest(fixture, josh, weth, "5");

    // send some CRV to the strategy to partly simulate reward harvesting
    await crv
      .connect(josh)
      .transfer(ConvexEthMetaStrategy.address, oethUnits("1000"));

    const wethBefore = await weth.balanceOf(oethDripper.address);

    // prettier-ignore
    await oethHarvester
      .connect(josh)["harvestAndSwap(address)"](ConvexEthMetaStrategy.address);

    const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
      wethBefore
    );
    await oethVault.connect(josh).rebase();

    await expect(wethDiff).to.be.gte(oethUnits("0.3"));
  });
});

async function mintTest(fixture, user, asset, amount = "3") {
  const {
    oethVault,
    oeth,
    ConvexEthMetaStrategy,
    cvxRewardPool,
    oethMetaPool,
  } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentVaultValue = await oethVault.totalValue();

  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);

  log("Before mint");
  await logCurvePool(oethMetaPool, "ETH ", "OETH");
  log(
    `netOusdMintedForStrategy ${await oethVault.netOusdMintedForStrategy()}}`
  );

  // Mint OUSD w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  log("After mint");
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
    .balanceOf(ConvexEthMetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );

  // multiplied by 2 because the strategy prints corresponding amount of OETH and
  // deploys it in the pool
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
    oethUnits(amount).mul(2),
    1
  );

  // Vault value checks
  const vaultValueAfter = await oethVault.totalValue();
  log(`Actual vault value  : ${formatUnits(vaultValueAfter)}`);
  log(
    `Expected vault value: ${formatUnits(
      currentVaultValue.add(unitAmount.mul(2))
    )}`
  );
  log(
    `Diff vault value    : ${formatUnits(
      vaultValueAfter.sub(currentVaultValue).sub(unitAmount.mul(2))
    )}`
  );
  expect(vaultValueAfter).to.approxEqualTolerance(
    currentVaultValue.add(unitAmount.mul(2))
  );
}
