const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits, isCI } = require("../../helpers");
const { impersonateAndFund } = require("../../../utils/signers");
const addresses = require("../../../utils/addresses");

const baseFixture = createFixtureLoader(defaultBaseFixture);

/**
 * OETHb Phase 1 migration fork test.
 *
 * Validates:
 *   1. The V1→V2 upgrade on BridgedWOETHStrategyProxy preserves V1 state.
 *   2. `bridgeToRemote(amount)` enforces the per-call cap and increments `totalBridged`.
 *   3. The migration invariant: `oldStrategy.checkBalance + master.checkBalance` is
 *      conserved across the 4-row state table.
 *
 * The real CCIP router is swapped out with `MockCCIPRouter` via the V2 strategy's
 * governor-callable `setCCIPConfig` so `bridgeToRemote` doesn't actually attempt CCIP
 * delivery (we only care about strategy-side accounting on this fork).
 */
describe("ForkTest: OETHb Phase 1 wOETH migration", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;
  let woethStrategyV2;
  let masterStrategy;
  let mockRouter;
  let woeth;
  let weth;
  let baseTimelock;

  beforeEach(async () => {
    fixture = await baseFixture();

    // Rebind the V1 strategy address as V2 ABI now that the upgrade ran.
    woethStrategyV2 = await ethers.getContractAt(
      "BridgedWOETHStrategyV2",
      fixture.woethStrategy.address
    );
    woeth = fixture.woeth;
    weth = fixture.weth;

    // Resolve the new V3 Master deployed by the PR 12 Base scripts.
    const masterProxyAddr = await woethStrategyV2.master();
    expect(masterProxyAddr).to.not.equal(addresses.zero);
    masterStrategy = await ethers.getContractAt(
      "MasterV3Strategy",
      masterProxyAddr
    );

    // Deploy and install the mock CCIP router so bridgeToRemote doesn't hit real CCIP.
    const MockRouterF = await ethers.getContractFactory("MockCCIPRouter");
    mockRouter = await MockRouterF.deploy();
    await mockRouter.deployed();

    // Swap CCIP router via the V2 strategy's governor-only setter.
    baseTimelock = await impersonateAndFund(addresses.base.timelock);
    await woethStrategyV2
      .connect(baseTimelock)
      .setCCIPConfig(
        mockRouter.address,
        await woethStrategyV2.ccipChainSelectorMainnet(),
        await woethStrategyV2.bridgeRecipient()
      );

    // Make sure the strategy has native to pay the (zero) fee in the mock.
    await fixture.governor.sendTransaction({
      to: woethStrategyV2.address,
      value: ethers.utils.parseEther("1"),
    });
  });

  it("preserves V1 state across the V1→V2 upgrade", async () => {
    // V1 storage variables must be readable through V2 at the same slot offsets.
    const lastOraclePrice = await woethStrategyV2.lastOraclePrice();
    const maxPriceDiffBps = await woethStrategyV2.maxPriceDiffBps();
    expect(lastOraclePrice).to.be.gt(0);
    expect(maxPriceDiffBps).to.be.gt(0);

    // V2 immutables resolve to the same Base-side token addresses.
    expect(await woethStrategyV2.weth()).to.equal(addresses.base.WETH);
    expect(await woethStrategyV2.bridgedWOETH()).to.equal(woeth.address);

    // V2 post-upgrade config wired by the deploy: master + ccipRouter + maxPerBridge.
    expect(await woethStrategyV2.master()).to.equal(masterStrategy.address);
    expect(await woethStrategyV2.maxPerBridge()).to.equal(oethUnits("1000"));
    expect(await woethStrategyV2.totalBridged()).to.equal(0);
  });

  it("rejects bridgeToRemote above MAX_PER_BRIDGE", async () => {
    const sStrategist = await impersonateAndFund(
      addresses.multichainStrategist
    );
    await expect(
      woethStrategyV2.connect(sStrategist).bridgeToRemote(oethUnits("1001"))
    ).to.be.revertedWith("BWV2: bad amount");
  });

  it("walks the migration state-table invariant across multiple batches", async () => {
    const sStrategist = await impersonateAndFund(
      addresses.multichainStrategist
    );

    // Total expected to bridge (in wOETH units).
    const startingLocal = await woeth.balanceOf(woethStrategyV2.address);
    expect(startingLocal).to.be.gt(0);
    const oraclePrice = await woethStrategyV2.lastOraclePrice();

    // Initial state: Row 1 — local = X, totalBridged = 0, master.checkBalance = 0.
    const totalBefore = await woethStrategyV2.checkBalance(weth.address);
    const masterBefore = await masterStrategy.checkBalance(weth.address);
    expect(masterBefore).to.equal(0);

    // Drive 3 batches of bridgeToRemote (less than the migration's 9 to keep test fast).
    const batchSize = oethUnits("1000");
    const batchCount = startingLocal.gte(batchSize.mul(3)) ? 3 : 1;
    let bridgedSoFar = ethers.BigNumber.from(0);
    for (let i = 0; i < batchCount; i++) {
      await woethStrategyV2.connect(sStrategist).bridgeToRemote(batchSize);
      bridgedSoFar = bridgedSoFar.add(batchSize);

      // After each batch the wOETH leaves the strategy but `totalBridged` rises.
      // Master hasn't received any balance updates yet (CCIP delivery is mocked),
      // so it still reports zero. The in-transit slot covers the bridged value.
      const local = await woeth.balanceOf(woethStrategyV2.address);
      const totalBridged = await woethStrategyV2.totalBridged();
      const checkBal = await woethStrategyV2.checkBalance(weth.address);
      const masterBal = await masterStrategy.checkBalance(weth.address);

      expect(totalBridged).to.equal(bridgedSoFar);
      expect(local).to.equal(startingLocal.sub(bridgedSoFar));
      expect(masterBal).to.equal(0);

      // checkBalance = (local + inTransit) * oraclePrice / 1e18
      const expected = local
        .add(bridgedSoFar) // inTransit = totalBridged - master(=0) = totalBridged
        .mul(oraclePrice)
        .div(ethers.utils.parseEther("1"));
      expect(checkBal).to.equal(expected);

      // Invariant: thisStrategy.checkBalance + master.checkBalance is non-decreasing
      // and stays at the original total (within rounding).
      const sum = checkBal.add(masterBal);
      expect(sum).to.equal(totalBefore);
    }

    // Confirm a CCIP send actually happened per batch.
    expect(await mockRouter.sentMessagesLength()).to.equal(
      ethers.BigNumber.from(batchCount)
    );
  });

  it("after a batch, the mock router holds the wOETH (proxying real CCIP custody)", async () => {
    const sStrategist = await impersonateAndFund(
      addresses.multichainStrategist
    );
    const batchSize = oethUnits("1000");
    const stratBefore = await woeth.balanceOf(woethStrategyV2.address);
    expect(stratBefore).to.be.gte(batchSize);

    await woethStrategyV2.connect(sStrategist).bridgeToRemote(batchSize);

    expect(await woeth.balanceOf(woethStrategyV2.address)).to.equal(
      stratBefore.sub(batchSize)
    );
    expect(await woeth.balanceOf(mockRouter.address)).to.equal(batchSize);
  });
});
