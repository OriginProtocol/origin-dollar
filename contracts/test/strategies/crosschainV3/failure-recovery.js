const { expect } = require("chai");
const { ethers } = require("hardhat");

// bridgeAsset (MockUSDC) is 6dp; oToken / wOToken are 18dp. SCALE is the 6→18 factor.
const SCALE = ethers.BigNumber.from(10).pow(12);
const usdc = (n) => ethers.utils.parseUnits(n, 6);
const oToken18 = (n) => ethers.utils.parseUnits(n, 18);
// Sentinel for "no outstanding queue request" (RemoteWOTokenStrategy.REQUEST_ID_EMPTY).
const EMPTY = ethers.constants.MaxUint256;

/**
 * Failure-recovery tests for the V3 Master+Remote pair (PR #2909 review):
 *  - Remote inbound yield handlers are revert-free: a failed mint/wrap (deposit) or
 *    unwrap/queue (withdraw-request) no longer bricks the serialized channel.
 *  - 291: Master's withdraw paths fold a negative `bridgeAdjustment` into the draw bound so a
 *    net BRIDGE_OUT can't make Master over-request shares Remote no longer holds.
 *
 * Same in-process loopback harness as `master-remote-pair.js`.
 */
describe("Unit: V3 failure recovery + drawable-balance gate", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;
  let adapterME, adapterRM;

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
    const masterInitData = masterImpl.interface.encodeFunctionData(
      "initialize",
      [governor.address]
    );
    await masterProxy
      .connect(deployer)
      .initialize(masterImpl.address, governor.address, masterInitData);
    master = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxy.address
    );

    const remoteProxy = await ProxyFactory.connect(deployer).deploy();
    const remoteInitData = remoteImpl.interface.encodeFunctionData(
      "initialize",
      [governor.address]
    );
    await remoteProxy
      .connect(deployer)
      .initialize(remoteImpl.address, governor.address, remoteInitData);
    remote = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      remoteProxy.address
    );

    await mockL2Vault.whitelistStrategy(master.address);

    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    adapterME = await AdapterFactory.deploy();
    adapterRM = await AdapterFactory.deploy();
    await adapterME.setSender(master.address);
    await adapterME.setPeer(remote.address);
    await adapterRM.setSender(remote.address);
    await adapterRM.setPeer(master.address);

    await master.connect(governor).setOutboundAdapter(adapterME.address);
    await master.connect(governor).setInboundAdapter(adapterRM.address);
    await remote.connect(governor).setOutboundAdapter(adapterRM.address);
    await remote.connect(governor).setInboundAdapter(adapterME.address);
    await remote.connect(governor).safeApproveAllTokens();
  });

  it("deposit mint failure is revert-free; value idle; retryDeposit recovers; channel lives", async () => {
    const AMOUNT = usdc("1000");

    // Remote's vault mint fails (e.g. paused vault). The deposit must NOT revert.
    await ethVault.setRevertOnMint(true);
    await bridgeAsset.mintTo(master.address, AMOUNT);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, AMOUNT);

    // Master accounting resolved via DEPOSIT_ACK; nonce advanced on both sides.
    expect(await master.pendingDepositAmount()).to.equal(0);
    expect(await master.isYieldOpInFlight()).to.equal(false);
    expect(await master.lastYieldNonce()).to.equal(1);
    expect(await remote.lastYieldNonce()).to.equal(1);

    // The bridgeAsset sits idle on Remote (mint failed) — still counted by the baseline, so
    // Master's value is unchanged. No wOToken shares yet.
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(AMOUNT);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(0);
    expect(await master.remoteStrategyBalance()).to.equal(AMOUNT.mul(SCALE));
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(AMOUNT);

    // Recover: re-enable mint and retry — idle value becomes productive wOToken.
    await ethVault.setRevertOnMint(false);
    await remote.connect(governor).retryDeposit();
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(0);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(
      AMOUNT.mul(SCALE)
    );

    // Channel is not bricked: a second deposit completes normally.
    await bridgeAsset.mintTo(master.address, AMOUNT);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, AMOUNT);
    expect(await master.lastYieldNonce()).to.equal(2);
    expect(await master.pendingDepositAmount()).to.equal(0);
  });

  it("retryDeposit reverts when there is nothing idle to recover", async () => {
    await expect(remote.connect(governor).retryDeposit()).to.be.revertedWith(
      "Remote: nothing to retry"
    );
  });

  it("withdraw-request queue failure: success=false, idle oToken recoverable, channel lives", async () => {
    const SEED = usdc("1000");
    const WITHDRAW = usdc("400");
    const SEED18 = SEED.mul(SCALE);
    const WITHDRAW18 = WITHDRAW.mul(SCALE);

    // Seed Remote shares with a successful deposit.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(SEED18);

    // The queue fails AFTER a successful unwrap. The request handler must not revert.
    await ethVault.setRevertOnRequestWithdrawal(true);
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    // success=false: nothing queued, Master cleared its pending withdrawal, channel free.
    expect(await remote.outstandingRequestId()).to.equal(EMPTY);
    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    expect(await master.isYieldOpInFlight()).to.equal(false);

    // Non-atomic: the unwrapped OToken is left idle (shares dropped, idle oToken up). Value is
    // preserved — the idle oToken is counted, so Master's balance is unchanged.
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(
      SEED18.sub(WITHDRAW18)
    );
    expect(await oTokenEth.balanceOf(remote.address)).to.equal(WITHDRAW18);
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(SEED);

    // Recover the idle oToken via retryDeposit (re-wrap to wOToken).
    await remote.connect(governor).retryDeposit();
    expect(await oTokenEth.balanceOf(remote.address)).to.equal(0);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(SEED18);

    // Channel lives: re-enable and a fresh withdraw request succeeds.
    await ethVault.setRevertOnRequestWithdrawal(false);
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );
    expect(await master.pendingWithdrawalAmount()).to.equal(WITHDRAW);
    expect(await remote.outstandingRequestId()).to.not.equal(EMPTY);
  });

  it("balance check does not freeze when bridge rounding drives B-A a hair negative (clamp to 0)", async () => {
    const BIN = oToken18("100"); // 18dp bridge-in amount
    const BIN_USDC = usdc("100"); // USDC alice spends to acquire the OToken

    // alice acquires OToken on the Eth side and BRIDGE_INs it: Remote wraps it, so
    // bridgeAdjustment (A) = wOToken value (B) = BIN, i.e. the yield baseline B - A = 0.
    await bridgeAsset.mintTo(alice.address, BIN_USDC);
    await bridgeAsset.connect(alice).approve(ethVault.address, BIN_USDC);
    await ethVault.connect(alice).mint(BIN_USDC);
    await oTokenEth.connect(alice).approve(remote.address, BIN);
    await remote.connect(alice).bridgeOTokenToPeer(BIN, alice.address, "0x", 0);
    expect(await master.bridgeAdjustment()).to.equal(BIN);

    // The wOToken 4626 rounding (here a 1-wei loss) tips B below A → B - A = -1.
    await woTokenEth.simulateLoss(1);

    // _yieldOnlyBaseline (via the balance-check round-trip) must NOT revert — it clamps to 0
    // instead of freezing the serialized yield channel on dust.
    await expect(master.connect(governor).requestBalanceCheck()).to.not.be
      .reverted;
    expect(await master.remoteStrategyBalance()).to.equal(0);

    // Channel is alive: a fresh deposit still completes (its ack also routes through
    // _yieldOnlyBaseline, which would have frozen pre-fix).
    const DEP = usdc("500");
    await bridgeAsset.mintTo(master.address, DEP);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, DEP);
    expect(await master.pendingDepositAmount()).to.equal(0);
  });

  it("291: withdrawAll is bounded by drawable balance after a net BRIDGE_OUT", async () => {
    const SEED = usdc("1000");
    const BRIDGE_OUT = oToken18("300");

    // 1. Deposit → rsb = 1000 (18dp), Remote holds 1000 shares, bridgeAdjustment = 0.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
    expect(await master.remoteStrategyBalance()).to.equal(SEED.mul(SCALE));

    // 2. Give alice L2 OToken via a (simulated) real deposit — NOT a bridge-in — then BRIDGE_OUT.
    //    This drives master.bridgeAdjustment negative and drops Remote's shares to 700, while
    //    Master's rsb stays a stale 1000 until the next balance check.
    await mockL2Vault.mintOTokenTo(alice.address, BRIDGE_OUT);
    await oTokenL2.connect(alice).approve(master.address, BRIDGE_OUT);
    await master
      .connect(alice)
      .bridgeOTokenToPeer(BRIDGE_OUT, alice.address, "0x", 0);

    expect(await master.bridgeAdjustment()).to.equal(BRIDGE_OUT.mul(-1));
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(
      SEED.mul(SCALE).sub(BRIDGE_OUT)
    );

    // 3. withdrawAll must request only the drawable 700 (rsb + min(adj,0)), not the stale 1000.
    //    Pre-291 it requested 1000, which Remote couldn't unwrap. Now it requests 700 and Remote
    //    queues it successfully (success=true → pendingWithdrawalAmount stays set).
    await master.connect(governor).withdrawAll();
    expect(await master.pendingWithdrawalAmount()).to.equal(usdc("700"));
    expect(await remote.outstandingRequestId()).to.not.equal(EMPTY);
  });

  it("post-delivery callback cannot re-enter (nonReentrant blocks it; delivery still completes)", async () => {
    const SEED = usdc("1000");
    const AMT = oToken18("100");

    // Seed Remote with shares so a BRIDGE_OUT can be delivered there.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);

    // Malicious recipient, armed to re-enter Remote.claimRemoteWithdrawal() (permissionless +
    // nonReentrant) from the post-delivery callback. Called normally it would succeed (no-op);
    // under re-entry it must fail because the bridge dispatch holds the shared nonReentrant lock.
    const receiver = await (
      await ethers.getContractFactory("MockReentrantReceiver")
    ).deploy();
    await receiver.arm(
      remote.address,
      remote.interface.encodeFunctionData("claimRemoteWithdrawal")
    );

    // alice BRIDGE_OUTs OToken to the malicious receiver on Remote, with the callback.
    await mockL2Vault.mintOTokenTo(alice.address, AMT);
    await oTokenL2.connect(alice).approve(master.address, AMT);
    await master
      .connect(alice)
      .bridgeOTokenToPeer(
        AMT,
        receiver.address,
        receiver.interface.encodeFunctionData("attack"),
        500000
      );

    // The callback ran, but the re-entry was blocked by the nonReentrant guard.
    expect(await receiver.reentered()).to.equal(true);
    expect(await receiver.reentrySucceeded()).to.equal(false);

    // Delivery still completed (tokens are sent before the callback, per CEI) and accounting is
    // applied exactly once.
    expect(await oTokenEth.balanceOf(receiver.address)).to.equal(AMT);
    expect(await remote.bridgeAdjustment()).to.equal(AMT.mul(-1));
  });
});
