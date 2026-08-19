const { expect } = require("chai");
const { ethers } = require("hardhat");

// The pair accounts in a single 18-decimal domain, so no scaling is needed.
const SCALE = ethers.BigNumber.from(1);
const usdc = (n) => ethers.utils.parseUnits(n, 18);
const oToken18 = (n) => ethers.utils.parseUnits(n, 18);
// Sentinel for "no outstanding queue request" (RemoteWOTokenStrategy.REQUEST_ID_EMPTY).
const EMPTY = ethers.constants.MaxUint256;

/**
 * Failure-recovery tests for the V3 Master+Remote pair (PR #2909 review):
 *  - Remote inbound yield handlers are revert-free: a failed mint/wrap (deposit) or
 *    unwrap/queue (withdraw-request) no longer bricks the serialized channel.
 *
 * Same in-process loopback harness as `master-remote-pair.js`.
 */
describe("Unit: V3 failure recovery", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;
  let adapterME, adapterRM;

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockDAI");
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
      bridgeAsset.address
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
});
