const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * End-to-end exercise of the operator-driven yield-channel round-trips:
 *   - requestBalanceCheck → BALANCE_CHECK_RESPONSE (updates remoteStrategyBalance from
 *     Remote's previewRedeem)
 *   - requestSettlement → SETTLE_BRIDGE_ACCOUNTING_ACK (zeros both sides' bridgeAdjustment and updates
 *     remoteStrategyBalance to the post-settlement view)
 *
 * Verifies the checkBalance invariant across yield accrual (mocked by sending OToken to
 * the 4626 vault to inflate previewRedeem) and across bridge-channel net inflows.
 */

describe("Unit: V3 settlement + balance check", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;

  const SEED = ethers.utils.parseUnits("5000", 6);
  // bridgeAsset (USDC) is 6dp; remoteStrategyBalance / bridgeAdjustment are OToken (18dp).
  // SCALE is the 6→18 factor: a SEED-USDC deposit shows up as SEED.mul(SCALE) on Remote.
  const SCALE = ethers.BigNumber.from(10).pow(12);

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    bridgeAsset = await ERC20Factory.deploy();

    const L2VaultFactory = await ethers.getContractFactory("MockOTokenVault");
    mockL2Vault = await L2VaultFactory.deploy();
    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
    );
    oTokenL2 = await OTokenFactory.deploy(
      "Mock OToken L2",
      "mOTL2",
      mockL2Vault.address
    );
    await mockL2Vault.setOToken(oTokenL2.address);

    const EthVaultFactory = await ethers.getContractFactory(
      "MockEthOTokenVault"
    );
    const ethNonce = await ethers.provider.getTransactionCount(
      deployer.address
    );
    const futureEthVault = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: ethNonce + 1,
    });
    oTokenEth = await OTokenFactory.deploy(
      "Mock OToken Eth",
      "mOTEth",
      futureEthVault
    );
    ethVault = await EthVaultFactory.deploy(
      bridgeAsset.address,
      oTokenEth.address
    );

    const WoFactory = await ethers.getContractFactory("MockERC4626Vault");
    woTokenEth = await WoFactory.deploy(oTokenEth.address);

    const MasterFactory = await ethers.getContractFactory(
      "MasterWOTokenStrategy"
    );
    const masterImpl = await MasterFactory.connect(deployer).deploy(
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: mockL2Vault.address,
      },
      bridgeAsset.address,
      oTokenL2.address
    );

    const RemoteFactory = await ethers.getContractFactory(
      "RemoteWOTokenStrategy"
    );
    const remoteImpl = await RemoteFactory.connect(deployer).deploy(
      {
        platformAddress: woTokenEth.address,
        vaultAddress: ethers.constants.AddressZero,
      },
      bridgeAsset.address,
      oTokenEth.address,
      woTokenEth.address,
      ethVault.address
    );

    const ProxyFactory = await ethers.getContractFactory(
      "InitializeGovernedUpgradeabilityProxy"
    );
    const masterProxy = await ProxyFactory.connect(deployer).deploy();
    await masterProxy
      .connect(deployer)
      .initialize(
        masterImpl.address,
        governor.address,
        masterImpl.interface.encodeFunctionData("initialize", [
          governor.address,
        ])
      );
    master = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxy.address
    );

    const remoteProxy = await ProxyFactory.connect(deployer).deploy();
    await remoteProxy
      .connect(deployer)
      .initialize(
        remoteImpl.address,
        governor.address,
        remoteImpl.interface.encodeFunctionData("initialize", [
          governor.address,
        ])
      );
    remote = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      remoteProxy.address
    );

    await mockL2Vault.whitelistStrategy(master.address);

    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    const adapterME = await AdapterFactory.deploy();
    const adapterRM = await AdapterFactory.deploy();
    await adapterME.setSender(master.address);
    await adapterME.setPeer(remote.address);
    await adapterRM.setSender(remote.address);
    await adapterRM.setPeer(master.address);

    await master.connect(governor).setOutboundAdapter(adapterME.address);
    await master.connect(governor).setInboundAdapter(adapterRM.address);
    await remote.connect(governor).setOutboundAdapter(adapterRM.address);
    await remote.connect(governor).setInboundAdapter(adapterME.address);
    await remote.connect(governor).safeApproveAllTokens();

    // Seed Remote with SEED via a deposit round-trip.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
  });

  it("requestBalanceCheck picks up yield accrued on the wOToken", async () => {
    // Simulate yield: airdrop OToken to the wOToken vault to inflate previewRedeem. Mint
    // YIELD USDC → YIELD*SCALE OToken (18dp), then donate all of it to the vault so the
    // increase is meaningful at the bridgeAsset (6dp) scale.
    const YIELD = ethers.utils.parseUnits("100", 6);
    await bridgeAsset.mintTo(deployer.address, YIELD);
    await bridgeAsset.approve(ethVault.address, YIELD);
    await ethVault.mint(YIELD);
    await oTokenEth.transfer(woTokenEth.address, YIELD.mul(SCALE));
    // Now previewRedeem(SEED shares) > SEED.

    // Before: Master's cached balance still equals the seeded baseline (18dp).
    expect(await master.remoteStrategyBalance()).to.equal(SEED.mul(SCALE));

    await master.connect(governor).requestBalanceCheck();

    // After: balance reflects the yield (18dp on Remote, 6dp on checkBalance).
    expect(await master.remoteStrategyBalance()).to.be.gt(SEED.mul(SCALE));
    expect(await master.checkBalance(bridgeAsset.address)).to.be.gt(SEED);
  });

  it("requestSettlement zeros both sides' bridgeAdjustment and refreshes balance", async () => {
    // Drive a bridge-in round trip to create unsettled deltas on both sides. AMT is the
    // bridged OToken amount (18dp); alice mints the bridgeAsset (6dp) needed to obtain it.
    const AMT = ethers.utils.parseUnits("250", 18);
    await bridgeAsset.mintTo(alice.address, AMT.div(SCALE));
    await bridgeAsset.connect(alice).approve(ethVault.address, AMT.div(SCALE));
    await ethVault.connect(alice).mint(AMT.div(SCALE));
    await oTokenEth.connect(alice).approve(remote.address, AMT);
    await remote.connect(alice).bridgeOTokenToPeer(AMT, alice.address, "0x", 0);

    expect(await master.bridgeAdjustment()).to.equal(AMT);
    expect(await remote.bridgeAdjustment()).to.equal(AMT);

    // Settlement
    await master.connect(governor).requestSettlement();

    expect(await master.bridgeAdjustment()).to.equal(0);
    expect(await remote.bridgeAdjustment()).to.equal(0);
    // remoteStrategyBalance now reflects the seeded deposit (18dp) plus the bridged-in shares.
    expect(await master.remoteStrategyBalance()).to.equal(
      SEED.mul(SCALE).add(AMT)
    );
  });

  it("balance check does NOT advance the yield nonce", async () => {
    // Locked design: balance check is non-blocking and nonce-echo. It uses
    // `lastYieldNonce` as an epoch marker without incrementing it.
    const nonceBefore = await master.lastYieldNonce();
    await master.connect(governor).requestBalanceCheck();
    await master.connect(governor).requestBalanceCheck();
    expect(await master.lastYieldNonce()).to.equal(nonceBefore);
  });

  it("requestBalanceCheck is non-blocking even when a withdrawal is pending", async () => {
    // Old design rejected with "Master: withdrawal pending"; new design is non-blocking.
    // The response is filtered at acceptance time (three guards in
    // _processBalanceCheckResponse) — pending op skips, nonce mismatch skips,
    // stale timestamp skips.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      ethers.utils.parseUnits("100", 6)
    );

    await expect(master.connect(governor).requestBalanceCheck()).to.not.be
      .reverted;
  });

  it("yield-only baseline: balance check reports correctly with bridgeAdjustment != 0", async () => {
    // Bridge-in 250 OToken (18dp) to create non-zero bridgeAdjustment on both sides — a
    // meaningful amount (not sub-bridgeAsset dust) so a double-count would actually move
    // checkBalance and the equality assertion is discriminating.
    const AMT = ethers.utils.parseUnits("250", 18);
    await bridgeAsset.mintTo(alice.address, AMT.div(SCALE));
    await bridgeAsset.connect(alice).approve(ethVault.address, AMT.div(SCALE));
    await ethVault.connect(alice).mint(AMT.div(SCALE));
    await oTokenEth.connect(alice).approve(remote.address, AMT);
    await remote.connect(alice).bridgeOTokenToPeer(AMT, alice.address, "0x", 0);

    expect(await master.bridgeAdjustment()).to.equal(AMT);
    expect(await remote.bridgeAdjustment()).to.equal(AMT);

    const checkBalBefore = await master.checkBalance(bridgeAsset.address);

    // Run balance check. Old design would double-count (remoteStrategyBalance updated to
    // reflect bridge effect, bridgeAdjustment still set). New design: Remote reports
    // yield-only baseline (_viewCheckBalance - bridgeAdjustment), Master combines with
    // its own bridgeAdjustment to reconstruct the correct total.
    await master.connect(governor).requestBalanceCheck();

    const checkBalAfter = await master.checkBalance(bridgeAsset.address);

    // Without yield-only baseline, checkBalAfter would be (SEED + AMT + AMT) = SEED + 2*AMT.
    // With yield-only baseline, checkBalAfter == checkBalBefore == SEED + AMT.
    expect(checkBalAfter).to.equal(checkBalBefore);
  });

  it("settlement snapshot preserves in-flight bridge ops", async () => {
    // Drive an initial bridge-in to set non-zero bridgeAdjustment.
    const FIRST = ethers.utils.parseUnits("100", 6);
    await bridgeAsset.mintTo(alice.address, FIRST);
    await bridgeAsset.connect(alice).approve(ethVault.address, FIRST);
    await ethVault.connect(alice).mint(FIRST);
    await oTokenEth.connect(alice).approve(remote.address, FIRST);
    await remote
      .connect(alice)
      .bridgeOTokenToPeer(FIRST, alice.address, "0x", 0);

    expect(await master.bridgeAdjustment()).to.equal(FIRST);
    expect(await remote.bridgeAdjustment()).to.equal(FIRST);

    // Pause the adapter that takes Master's settle message to Remote, so Master fires
    // settle but Remote doesn't process it yet. Meanwhile, a second bridge-in lands.
    const inboundOnRemote = await ethers.getContractAt(
      "MockBridgeAdapter",
      await remote.inboundAdapter()
    );
    await inboundOnRemote.setDeliveryEnabled(false);

    // Master fires settle. Snapshot captured = FIRST (current bridgeAdjustment).
    await master.connect(governor).requestSettlement();
    expect(await master.settlementSnapshot()).to.equal(FIRST);

    // Master.bridgeAdjustment unchanged until ack lands; still = FIRST.
    expect(await master.bridgeAdjustment()).to.equal(FIRST);

    // While settle is in flight, another bridge-in for SECOND.
    const SECOND = ethers.utils.parseUnits("75", 6);
    await bridgeAsset.mintTo(alice.address, SECOND);
    await bridgeAsset.connect(alice).approve(ethVault.address, SECOND);
    await ethVault.connect(alice).mint(SECOND);
    await oTokenEth.connect(alice).approve(remote.address, SECOND);
    await remote
      .connect(alice)
      .bridgeOTokenToPeer(SECOND, alice.address, "0x", 0);

    // Master's bridgeAdjustment is now FIRST + SECOND (second bridge_in applied locally).
    expect(await master.bridgeAdjustment()).to.equal(FIRST.add(SECOND));
    // Remote hasn't processed settle OR new bridge_in yet (delivery disabled).

    // Re-enable delivery and flush pending; both messages reach Remote and settle ack
    // reaches Master.
    await inboundOnRemote.setDeliveryEnabled(true);
    await inboundOnRemote.flushPendingDelivery();

    // Both sides should converge: bridgeAdjustment -= snapshot (FIRST), leaving SECOND.
    expect(await master.bridgeAdjustment()).to.equal(SECOND);
    expect(await master.settlementSnapshot()).to.equal(0); // cleared
  });

  it("governor can sweep native ETH from the strategy via transferNative", async () => {
    // Send some ETH to Master (simulating operator top-up of the fee pool).
    const POOL = ethers.utils.parseEther("0.5");
    await deployer.sendTransaction({ to: master.address, value: POOL });
    expect(await ethers.provider.getBalance(master.address)).to.equal(POOL);

    const govBefore = await ethers.provider.getBalance(governor.address);
    const tx = await master.connect(governor).transferNative(POOL);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const govAfter = await ethers.provider.getBalance(governor.address);

    // Governor received POOL - gas spent on the call.
    expect(govAfter.sub(govBefore)).to.equal(POOL.sub(gasCost));
    expect(await ethers.provider.getBalance(master.address)).to.equal(0);
  });

  it("non-governor cannot call transferNative", async () => {
    await deployer.sendTransaction({
      to: master.address,
      value: ethers.utils.parseEther("0.1"),
    });
    await expect(master.connect(alice).transferNative(1)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });
});
