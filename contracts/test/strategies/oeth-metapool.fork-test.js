const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  convexOETHMetaVaultFixture,
  impersonateAndFundContract,
} = require("../_fixture");

forkOnlyDescribe("ForkTest: OETH Curve Metapool Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  it("Should stake WETH in Curve guage via metapool", async function () {
    // TODO: should have differently balanced metapools
    const fixture = await loadFixture(convexOETHMetaVaultFixture);

    const { josh, weth } = fixture;
    await mintTest(fixture, josh, weth, "5");
  });

  it("Should be able to withdraw all", async () => {
    const { oethVault, oeth, weth, josh, ConvexEthMetaStrategy } =
      await loadFixture(convexOETHMetaVaultFixture);

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
    const { oethVault, oeth, weth, josh, ConvexEthMetaStrategy } =
      await loadFixture(convexOETHMetaVaultFixture);

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
    const fixture = await loadFixture(convexOETHMetaVaultFixture);

    const {
      josh,
      weth,
      oeth,
      oethHarvester,
      oethVault,
      ConvexEthMetaStrategy,
      crv,
    } = fixture;
    await mintTest(fixture, josh, weth, "5");

    // send some CRV to the strategy to partly simulate reward harvesting
    await crv
      .connect(josh)
      .transfer(ConvexEthMetaStrategy.address, oethUnits("1000"));

    const wethBefore = await weth.balanceOf(oethVault.address);
    const totalSupply = await oeth.totalSupply();

    await oethHarvester
      .connect(josh)
      ["harvestAndSwap(address)"](ConvexEthMetaStrategy.address);

    const wethDiff = (await weth.balanceOf(oethVault.address)).sub(wethBefore);
    const totalSupplyDiff = (await oeth.totalSupply()).sub(totalSupply);
    await oethVault.connect(josh).rebase();

    await expect(wethDiff).to.be.gte(oethUnits("0.3"));
    // TODO this one fails
    await expect(totalSupplyDiff).to.be.gte(oethUnits("0.3"));
  });
});

async function mintTest(fixture, user, asset, amount = "3") {
  const {
    oethVault,
    oeth,
    weth,
    cvxRewardStakerAddress,
    ConvexEthMetaStrategy,
    cvxRewardPool,
  } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);

  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);

  // Mint OUSD w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

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

  /* Should have staked the LP tokens
   *
   * half of the LP tokens are received because the price of the lp token
   * is multiplied by 2 ( https://github.com/curvefi/curve-factory-crypto/blob/ecf60c360e230d6a4ba1e5cb31ab8b61d545f452/contracts/CurveCryptoSwap2ETH.vy#L1308-L1312)
   *
   * TO BE CONFIRMED: this is because the pool doesn't actually have 2 underlying
   * tokens but only one coupled with ETH.
   */
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(oethUnits(amount), 1);
}
