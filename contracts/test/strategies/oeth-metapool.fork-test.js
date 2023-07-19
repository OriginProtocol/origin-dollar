const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  defaultFixtureSetup,
  convexOETHMetaVaultFixtureSetup,
  impersonateAndFundContract,
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

  it("Should rebalance Metapool", async () => {
    const {
      oeth,
      oethVault,
      oethMetaPool,
      timelock,
      ConvexEthMetaStrategy,
      weth,
    } = fixture;

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
    log(
      `after withdraw vault WETH  : ${formatUnits(
        await weth.balanceOf(oethVault.address)
      )}`
    );
    // STEP 4 - Deposit to strategy
    log(`about to deposit ${formatUnits(wethWithdrawn)} WETH`);
    await oethVault
      .connect(timelock)
      .depositToStrategy(
        ConvexEthMetaStrategy.address,
        [weth.address],
        [wethWithdrawn]
      );
    log(
      `Deposited ${wethWithdrawn} + ${formatUnits(
        wethWithdrawn
      )} = ${formatUnits(wethWithdrawn)} WETH to strategy`
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

  it("Should be able to check balance", async () => {
    const { weth, josh, ConvexEthMetaStrategy } = fixture;

    const balance = await ConvexEthMetaStrategy.checkBalance(weth.address);
    log(`check balance ${balance}`);
    expect(balance).gt(0);

    // This uses a transaction to call a view function so the gas usage can be reported.
    const tx = await ConvexEthMetaStrategy.connect(
      josh
    ).populateTransaction.checkBalance(weth.address);
    await josh.sendTransaction(tx);
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

  it("Strategist should be able to add OETH to pool", async () => {
    const { oethVault, oeth, timelock, ConvexEthMetaStrategy } = fixture;

    await oethVault
      .connect(timelock)
      .depositToStrategy(
        ConvexEthMetaStrategy.address,
        [oeth.address],
        [parseUnits("100")]
      );
  });

  it("Strategist should be able to remove OETH from pool", async () => {
    const { oethVault, oethMetaPool, timelock, ConvexEthMetaStrategy } =
      fixture;

    await oethVault
      .connect(timelock)
      .withdrawFromStrategy(
        ConvexEthMetaStrategy.address,
        [oethMetaPool.address],
        [parseUnits("100")]
      );
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
    await mintTest(fixture, josh, weth, "50");

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
    weth,
  } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const totalSupplyBefore = await oeth.totalSupply();
  log(`total supply before ${formatUnits(totalSupplyBefore)}`);
  const userBalanceBefore = await oeth.connect(user).balanceOf(user.address);
  const wethVaultBalanceBefore = await weth.balanceOf(oethVault.address);
  log(`WETH in vault before ${formatUnits(wethVaultBalanceBefore)}`);

  const poolBalancesBefore = await oethMetaPool.get_balances();

  const rewardPoolBalanceBefore = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);
  log(
    `strategy LP tokens in Convex before ${formatUnits(
      rewardPoolBalanceBefore
    )}}`
  );

  await logCurvePool(oethMetaPool, "ETH ", "OETH");

  // Mint OUSD w/ asset and auto allocate to strategy
  log(`About to mint using ${amount} ${await asset.symbol()}`);
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);

  await logCurvePool(oethMetaPool, "ETH ", "OETH");

  // Ensure user has correct balance after mint (w/ 1% slippage tolerance)
  const userBalanceAfter = await oeth.connect(user).balanceOf(user.address);
  const userBalanceDiffAfter = userBalanceAfter.sub(userBalanceBefore);
  expect(userBalanceDiffAfter).to.approxEqualTolerance(unitAmount, 1);

  const expectedSupplyDiff = calcExpetedSupplyDiff(
    poolBalancesBefore,
    unitAmount
  );

  // Supply checks after deposit
  const totalSupplyAfter = await oeth.totalSupply();
  const totalSupplyDiffAfter = totalSupplyAfter.sub(totalSupplyBefore);
  log(
    `total supply after ${formatUnits(totalSupplyAfter)} diff ${formatUnits(
      totalSupplyDiffAfter
    )}`
  );
  expect(totalSupplyDiffAfter).to.equal(expectedSupplyDiff);

  // Ensure some LP tokens got staked under OUSDMetaStrategy address
  const rewardPoolBalanceAfter = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);
  const rewardPoolBalanceDiff = rewardPoolBalanceAfter.sub(
    rewardPoolBalanceBefore
  );
  log(
    `strategy LP tokens in Convex after deposit ${formatUnits(
      rewardPoolBalanceAfter
    )} diff ${formatUnits(rewardPoolBalanceDiff)}`
  );

  // Ensure the strategy's Metapool LP balance has increased
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
    expectedSupplyDiff,
    1 // percent
  );
}

function calcExpetedSupplyDiff(poolBalancesBefore, unitAmount) {
  // multiply by 2 because the strategy prints corresponding amount of OETH
  // multiply by 3 if more ETH as the OETH amount will be 2x the ETH amount
  const balanceDiff = poolBalancesBefore[0]
    .add(unitAmount)
    .sub(poolBalancesBefore[1]);
  log(`pool balance diff after adding ETH ${formatUnits(balanceDiff)}`);
  const expectedSupplyDiff = balanceDiff.lte(0)
    ? unitAmount.mul(2)
    : balanceDiff.gt(unitAmount.mul(2))
    ? unitAmount.mul(3)
    : unitAmount.add(balanceDiff);
  log(`expected total supply diff ${formatUnits(expectedSupplyDiff)}`);

  return expectedSupplyDiff;
}
