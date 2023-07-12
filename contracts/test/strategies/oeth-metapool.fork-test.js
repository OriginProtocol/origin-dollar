const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { loadFixture } = require("ethereum-waffle");

const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  convexOETHMetaVaultFixture,
  impersonateAndFundContract,
} = require("../_fixture");
const { logCurvePool } = require("../../utils/curve");

const log = require("../../utils/logger")("test:fork:oeth:metapool");

forkOnlyDescribe("ForkTest: OETH AMO Curve Metapool Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  it("Should rebalance Metapool", async () => {
    const {
      oeth,
      oethVault,
      oethMetaPool,
      timelock,
      ConvexEthMetaStrategy,
      weth,
    } = await loadFixture(convexOETHMetaVaultFixture);

    // STEP 1 - rebase
    await oethVault.rebase();

    // STEP 2 - take snapshot
    const cChecker = await ethers.getContract("OETHVaultValueChecker");
    await cChecker.connect(timelock).takeSnapshot();
    const snapshot = await cChecker.snapshots(await timelock.getAddress());
    log(`before vault value : ${formatUnits(snapshot.vaultValue)}`);
    log(`before vault supply: ${formatUnits(snapshot.totalSupply)}`);
    log(
      `before vault WETH  : ${formatUnits(
        await weth.balanceOf(oethVault.address)
      )}`
    );

    await logCurvePool(oethMetaPool, "ETH ", "OETH");

    // STEP 3 - Withdraw from strategy
    const withdrawTx = await oethVault
      .connect(timelock)
      .withdrawAllFromStrategy(ConvexEthMetaStrategy.address);
    // Get WETH's Deposit event
    // remove OETH/ETH liquidity from pool and deposit ETH to get WETH to transfer to the Vault.
    const withdrawReceipt = await withdrawTx.wait();
    const depositLogs = withdrawReceipt.logs.filter(
      (l) =>
        l.address === weth.address &&
        l.topics[0] ===
          weth.interface.encodeFilterTopics("Deposit", []).toString()
    );
    const depositEvent = weth.interface.parseLog(depositLogs[0]);
    const wethWithdrawn = depositEvent.args.wad;
    log(`Withdrew ${formatUnits(wethWithdrawn)} WETH from strategy`);

    // STEP 4 - Deposit to strategy
    const additionAmount = 660;
    const depositAmount = wethWithdrawn.add(
      parseUnits(additionAmount.toString())
    );
    await oethVault
      .connect(timelock)
      .depositToStrategy(
        ConvexEthMetaStrategy.address,
        [weth.address],
        [depositAmount]
      );
    log(
      `Deposited ${additionAmount} + ${formatUnits(
        wethWithdrawn
      )} = ${formatUnits(depositAmount)} WETH to strategy`
    );

    // STEP 5 - log results
    const valueAfter = await oethVault.totalValue();
    const valueChange = valueAfter.sub(snapshot.vaultValue);
    log(`after vault value : ${formatUnits(valueAfter)}`);
    const supplyAfter = await oeth.totalSupply();
    const supplyChange = supplyAfter.sub(snapshot.totalSupply);
    log(`after vault supply: ${formatUnits(supplyAfter)}`);
    log(
      `after vault WETH  : ${formatUnits(
        await weth.balanceOf(oethVault.address)
      )}`
    );

    log(`value change : ${formatUnits(valueChange)}`);
    log(`supply change: ${formatUnits(supplyChange)}`);
    const profit = valueChange.sub(supplyChange);
    log(`profit       : ${formatUnits(profit)}`);

    await logCurvePool(oethMetaPool, "ETH ", "OETH");

    // STEP 6 - check delta
    const variance = parseUnits("1", 15);
    await cChecker
      .connect(timelock)
      .checkDelta(profit, variance, valueChange, variance);
  });

  it("Should deposit to Metapool", async function () {
    // TODO: should have differently balanced metapools
    const fixture = await loadFixture(convexOETHMetaVaultFixture);

    const { josh, weth } = fixture;

    await mintTest(fixture, josh, weth, "5000");
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
