const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MSG, encodePackedEnvelope } = require("./_helpers");

/**
 * End-to-end exercise of the operator-driven balance report: Remote pushes
 * BALANCE_REPORT unprompted via `sendBalanceReport`, refreshing Master's
 * `remoteStrategyBalance` from Remote's `previewRedeem`.
 *
 * Verifies the checkBalance invariant across yield accrual (mocked by sending OToken to
 * the 4626 vault to inflate previewRedeem).
 */

describe("Unit: V3 balance check", function () {
  let deployer, governor, alice;
  let bridgeAsset, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;
  let adapterRM;

  const SEED = ethers.utils.parseUnits("5000", 18);
  // The pair accounts in a single 18-decimal domain, so no scaling is needed.
  const SCALE = ethers.BigNumber.from(1);

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockDAI");
    bridgeAsset = await ERC20Factory.deploy();

    const L2VaultFactory = await ethers.getContractFactory("MockOTokenVault");
    mockL2Vault = await L2VaultFactory.deploy();
    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
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

    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    const adapterME = await AdapterFactory.deploy();
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

    // Seed Remote with SEED via a deposit round-trip.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
  });

  // Deliver a crafted BALANCE_REPORT through Master's inbound-adapter seat. Bypassing the
  // mock adapter is deliberate: it only keeps one pending message, so it cannot hold a
  // stale report while a fresh one goes past it.
  const injectReport = async (nonce, balance, timestamp) => {
    await master.connect(governor).setInboundAdapter(deployer.address);
    const envelope = encodePackedEnvelope(
      MSG.BALANCE_REPORT,
      nonce,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [balance, timestamp]
      )
    );
    await master
      .connect(deployer)
      .receiveMessage(
        remote.address,
        ethers.constants.AddressZero,
        0,
        envelope
      );
  };

  const currentTime = async () =>
    (await ethers.provider.getBlock("latest")).timestamp;

  it("sendBalanceReport picks up yield accrued on the wOToken", async () => {
    // Simulate yield: airdrop OToken to the wOToken vault to inflate previewRedeem. Mint
    // YIELD USDC → YIELD*SCALE OToken (18dp), then donate all of it to the vault so the
    // increase is meaningful at the bridgeAsset scale.
    const YIELD = ethers.utils.parseUnits("100", 18);
    await bridgeAsset.mintTo(deployer.address, YIELD);
    await bridgeAsset.approve(ethVault.address, YIELD);
    await ethVault.mint(YIELD);
    await oTokenEth.transfer(woTokenEth.address, YIELD.mul(SCALE));
    // Now previewRedeem(SEED shares) > SEED.

    // Before: Master's cached balance still equals the seeded baseline (18dp).
    expect(await master.remoteStrategyBalance()).to.equal(SEED.mul(SCALE));

    await remote.connect(governor).sendBalanceReport();

    // After: balance reflects the yield.
    expect(await master.remoteStrategyBalance()).to.be.gt(SEED.mul(SCALE));
    expect(await master.checkBalance(bridgeAsset.address)).to.be.gt(SEED);
  });

  it("balance report does NOT advance the yield nonce on either side", async () => {
    // Locked design: a balance report is non-blocking and stamped with the current nonce
    // as an epoch marker, without incrementing it.
    const masterNonceBefore = await master.lastYieldNonce();
    const remoteNonceBefore = await remote.lastYieldNonce();
    await remote.connect(governor).sendBalanceReport();
    await remote.connect(governor).sendBalanceReport();
    expect(await master.lastYieldNonce()).to.equal(masterNonceBefore);
    expect(await remote.lastYieldNonce()).to.equal(remoteNonceBefore);
  });

  it("guard 1: a report landing mid-deposit is ignored (would double-count)", async () => {
    // The dangerous case guard 1 exists for. Hold the ack so Master stays in-flight while
    // Remote has already processed the deposit: both sides are at N+1, so the nonce guard
    // passes and only `isYieldOpInFlight()` stands between us and counting the deposit
    // twice — once in pendingDepositAmount, once in the reported remoteStrategyBalance.
    await adapterRM.setDeliveryEnabled(false);

    const TOP_UP = ethers.utils.parseUnits("250", 18);
    await bridgeAsset.mintTo(master.address, TOP_UP);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, TOP_UP);

    expect(await master.isYieldOpInFlight()).to.equal(true);
    expect(await master.pendingDepositAmount()).to.equal(TOP_UP);
    const inFlightNonce = await master.lastYieldNonce();
    expect(await remote.lastYieldNonce()).to.equal(inFlightNonce);
    const cachedBefore = await master.remoteStrategyBalance();

    // Remote's live balance already includes the deposit — that is precisely what must
    // not be written to Master while pendingDepositAmount still counts it.
    await injectReport(
      inFlightNonce,
      await remote.checkBalance(bridgeAsset.address),
      (await currentTime()) + 1000
    );

    expect(await master.remoteStrategyBalance()).to.equal(cachedBefore);
  });

  it("guard 3: an out-of-order report cannot overwrite a newer one", async () => {
    // Land a report normally, then deliver one stamped earlier. Both timestamps come from
    // Remote's own clock, so `>` is an exact ordering and the older reading must lose.
    await remote.connect(governor).sendBalanceReport();
    const accepted = await master.remoteStrategyBalance();
    const acceptedAt = await master.lastBalanceCheckTimestamp();
    expect(acceptedAt).to.be.gt(0);

    const bogus = ethers.utils.parseUnits("1", 18);
    await injectReport(await master.lastYieldNonce(), bogus, acceptedAt.sub(1));

    expect(await master.remoteStrategyBalance()).to.equal(accepted);
    expect(await master.lastBalanceCheckTimestamp()).to.equal(acceptedAt);
  });

  it("guard 3: an equal timestamp is also rejected (strict monotonic)", async () => {
    await remote.connect(governor).sendBalanceReport();
    const accepted = await master.remoteStrategyBalance();
    const acceptedAt = await master.lastBalanceCheckTimestamp();

    await injectReport(
      await master.lastYieldNonce(),
      ethers.utils.parseUnits("1", 18),
      acceptedAt
    );

    expect(await master.remoteStrategyBalance()).to.equal(accepted);
  });

  it("guard 2: a report predating a completed deposit is ignored", async () => {
    // The tightest case: the report is sent at nonce N, a deposit completes (both sides
    // advance to N+1, and its ack refreshes remoteStrategyBalance), and only then does the
    // stale report land. Guard 1 has already cleared by that point — the nonce stamp is
    // what identifies the report as belonging to a superseded epoch.
    const staleNonce = await master.lastYieldNonce();

    // Complete a deposit round-trip; its DEPOSIT_ACK moves Master to N+1.
    const TOP_UP = ethers.utils.parseUnits("250", 18);
    await bridgeAsset.mintTo(master.address, TOP_UP);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, TOP_UP);
    expect(await master.lastYieldNonce()).to.be.gt(staleNonce);
    const afterDeposit = await master.remoteStrategyBalance();

    // Inject the stale report, carrying an obviously-wrong balance and a far-future
    // timestamp so an accidental acceptance would be unmissable and could not be
    // attributed to the timestamp guard.
    await injectReport(
      staleNonce,
      ethers.utils.parseUnits("1", 18),
      (await currentTime()) + 10000
    );

    // Rejected on the nonce guard, despite carrying a far-future timestamp.
    expect(await master.remoteStrategyBalance()).to.equal(afterDeposit);
  });

  it("rejects sendBalanceReport from a non-operator, non-governor", async () => {
    await expect(remote.connect(alice).sendBalanceReport()).to.be.reverted;
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
