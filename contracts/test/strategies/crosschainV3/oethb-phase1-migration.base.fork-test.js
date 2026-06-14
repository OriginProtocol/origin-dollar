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
 *   1. The V1→Migration upgrade on BridgedWOETHStrategyProxy preserves V1 state.
 *   2. `bridgeToRemote(amount)` enforces the per-call cap and increments `totalBridged`.
 *   3. The migration invariant: `oldStrategy.checkBalance + master.checkBalance` is
 *      conserved across the state table.
 *
 * The CCIP router on the deployed impl is an immutable, so we replicate the same
 * impl with `MockCCIPRouter` and upgrade the proxy to the replica for the test —
 * `bridgeToRemote` then doesn't attempt real CCIP delivery (we only care about
 * strategy-side accounting on this fork).
 */
describe("ForkTest: OETHb Phase 1 wOETH migration", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;
  let woethMigration;
  let masterStrategy;
  let mockRouter;
  let woeth;
  let weth;
  let baseTimelock;

  beforeEach(async () => {
    fixture = await baseFixture();

    // Rebind the V1 strategy address as the migration impl now that the upgrade ran.
    woethMigration = await ethers.getContractAt(
      "BridgedWOETHMigrationStrategy",
      fixture.woethStrategy.address
    );
    woeth = fixture.woeth;
    weth = fixture.weth;

    // Resolve the new V3 Master deployed by the PR 12 Base scripts.
    const masterProxyAddr = await woethMigration.master();
    expect(masterProxyAddr).to.not.equal(addresses.zero);
    masterStrategy = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxyAddr
    );

    // CCIP router is immutable on the migration impl. To avoid hitting real CCIP in
    // this fork, redeploy the impl with a mock router and upgrade the proxy to it.
    const MockRouterF = await ethers.getContractFactory("MockCCIPRouter");
    mockRouter = await MockRouterF.deploy();
    await mockRouter.deployed();

    const MigrationF = await ethers.getContractFactory(
      "BridgedWOETHMigrationStrategy"
    );
    const vaultAddr = await woethMigration.vaultAddress();
    const oethbAddr = await woethMigration.oethb();
    const oracleAddr = await woethMigration.oracle();
    const chainSelector = await woethMigration.ccipChainSelectorMainnet();
    const replicaImpl = await MigrationF.deploy(
      [addresses.zero, vaultAddr],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      oethbAddr,
      oracleAddr,
      masterProxyAddr,
      mockRouter.address,
      chainSelector
    );
    await replicaImpl.deployed();

    baseTimelock = await impersonateAndFund(addresses.base.timelock);
    const proxy = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      woethMigration.address
    );
    await proxy.connect(baseTimelock).upgradeTo(replicaImpl.address);

    // Make sure the strategy has native to pay the (zero) fee in the mock.
    await fixture.governor.sendTransaction({
      to: woethMigration.address,
      value: ethers.utils.parseEther("1"),
    });
  });

  it("preserves V1 state across the V1→Migration upgrade", async () => {
    // V1 storage variables must remain readable through the migration impl at the same slots.
    const lastOraclePrice = await woethMigration.lastOraclePrice();
    const maxPriceDiffBps = await woethMigration.maxPriceDiffBps();
    expect(lastOraclePrice).to.be.gt(0);
    expect(maxPriceDiffBps).to.be.gt(0);

    // Inherited immutables resolve to the same Base-side token addresses.
    expect(await woethMigration.weth()).to.equal(addresses.base.WETH);
    expect(await woethMigration.bridgedWOETH()).to.equal(woeth.address);

    // Migration-impl immutables: master + ccipChainSelectorMainnet.
    expect(await woethMigration.master()).to.equal(masterStrategy.address);
    expect(await woethMigration.maxPerBridge()).to.equal(oethUnits("1000"));
    expect(await woethMigration.totalBridged()).to.equal(0);
  });

  it("rejects bridgeToRemote above MAX_PER_BRIDGE", async () => {
    const sStrategist = await impersonateAndFund(
      addresses.multichainStrategist
    );
    await expect(
      woethMigration.connect(sStrategist).bridgeToRemote(oethUnits("1001"))
    ).to.be.revertedWith("BWM: bad amount");
  });

  it("walks the migration state-table invariant across multiple batches", async () => {
    const sStrategist = await impersonateAndFund(
      addresses.multichainStrategist
    );

    // Total expected to bridge (in wOETH units).
    const startingLocal = await woeth.balanceOf(woethMigration.address);
    expect(startingLocal).to.be.gt(0);
    const oraclePrice = await woethMigration.lastOraclePrice();

    // Initial state: Row 1 — local = X, totalBridged = 0, master.checkBalance = 0.
    const totalBefore = await woethMigration.checkBalance(weth.address);
    const masterBefore = await masterStrategy.checkBalance(weth.address);
    expect(masterBefore).to.equal(0);

    // Drive 3 batches of bridgeToRemote (less than the migration's 9 to keep test fast).
    const batchSize = oethUnits("1000");
    const batchCount = startingLocal.gte(batchSize.mul(3)) ? 3 : 1;
    let bridgedSoFar = ethers.BigNumber.from(0);
    for (let i = 0; i < batchCount; i++) {
      await woethMigration.connect(sStrategist).bridgeToRemote(batchSize);
      bridgedSoFar = bridgedSoFar.add(batchSize);

      // After each batch the wOETH leaves the strategy but `totalBridged` rises.
      // Master hasn't received any balance updates yet (CCIP delivery is mocked),
      // so it still reports zero. The in-transit slot covers the bridged value.
      const local = await woeth.balanceOf(woethMigration.address);
      const totalBridged = await woethMigration.totalBridged();
      const checkBal = await woethMigration.checkBalance(weth.address);
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
    const stratBefore = await woeth.balanceOf(woethMigration.address);
    expect(stratBefore).to.be.gte(batchSize);

    await woethMigration.connect(sStrategist).bridgeToRemote(batchSize);

    expect(await woeth.balanceOf(woethMigration.address)).to.equal(
      stratBefore.sub(batchSize)
    );
    expect(await woeth.balanceOf(mockRouter.address)).to.equal(batchSize);
  });
});
