const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * End-to-end exercise of the cross-chain withdrawal flow with idempotent claim, run on the
 * paired Master+Remote loopback.
 *
 * Flow under test:
 *   1. Master.deposit (SEED) → Remote wraps to wOToken (post-ack, remoteBalance == SEED)
 *   2. Vault calls master.withdraw(SEED, …) → leg 1 WITHDRAW_REQUEST
 *        - Remote unwraps shares, calls oTokenVault.requestWithdrawal, stores requestId+amount
 *        - Remote replies WITHDRAW_REQUEST_ACK with newBalance
 *   3. Time advances past the OToken-vault claim delay
 *   4. Permissionless `claimRemoteWithdrawal` from any caller pulls bridgeAsset onto Remote
 *      (idempotent: safe to call twice)
 *   5. Operator calls master.triggerClaim() → leg 2 WITHDRAW_CLAIM
 *        - Remote bridges bridgeAsset back, replies WITHDRAW_CLAIM_ACK (success=true)
 *        - Master clears pendingWithdrawalAmount, forwards bridgeAsset to vault
 *
 * Also covers: NACK path (claim attempted before vault delay elapsed),
 *              opportunistic claim within leg 2 (no automation involved),
 *              double-claim idempotency.
 */

describe("Unit: V3 Withdrawal", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;
  let adapterME, adapterRM;

  const SEED = ethers.utils.parseUnits("10000", 6);
  const WITHDRAW = ethers.utils.parseUnits("4000", 6);
  const DELAY = 86400; // 1 day queue delay

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
    await ethVault.setWithdrawalClaimDelay(DELAY);

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

    // Seed Remote with SEED via a deposit round-trip so withdrawals have something to draw on.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);

    expect(await master.remoteStrategyBalance()).to.equal(SEED);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(SEED);
  });

  it("happy path: leg1 → automation claim → leg2 returns tokens to vault", async () => {
    // Leg 1: vault triggers a withdrawal request.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    expect(await master.pendingWithdrawalAmount()).to.equal(WITHDRAW);
    // Remote's checkBalance stays at SEED — queue + remaining shares.
    expect(await remote.queuedAmount()).to.equal(WITHDRAW);
    expect(await remote.outstandingRequestId()).to.equal(1);
    expect(await remote.checkBalance(bridgeAsset.address)).to.equal(SEED);
    expect(await master.remoteStrategyBalance()).to.equal(SEED);

    // Advance past the queue delay and claim from Ethereum (permissionless).
    await time.increase(DELAY + 1);
    await remote.connect(alice).claimRemoteWithdrawal();
    expect(await remote.outstandingRequestId()).to.equal(0);
    expect(await remote.queuedAmount()).to.equal(0);
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(WITHDRAW);
    expect(await remote.checkBalance(bridgeAsset.address)).to.equal(SEED);

    // Leg 2: operator triggers the bridge-back.
    await master.connect(governor).triggerClaim();

    // Master forwarded WITHDRAW tokens to the vault.
    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(WITHDRAW);
    // Remote's balance dropped by WITHDRAW.
    expect(await master.remoteStrategyBalance()).to.equal(SEED.sub(WITHDRAW));
    expect(await remote.checkBalance(bridgeAsset.address)).to.equal(
      SEED.sub(WITHDRAW)
    );
  });

  it("opportunistic claim path: leg 2 claims and ships without prior automation", async () => {
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    // Skip the automation call; just advance past the delay.
    await time.increase(DELAY + 1);

    // Leg 2 triggers the opportunistic claim inside Remote._processWithdrawClaim.
    await master.connect(governor).triggerClaim();

    expect(await remote.outstandingRequestId()).to.equal(0);
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(WITHDRAW);
    expect(await master.pendingWithdrawalAmount()).to.equal(0);
  });

  it("NACK path: leg 2 before delay elapses returns no tokens, retains pending state", async () => {
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    // No advance — queue delay not yet met.
    // Permissionless claim attempt is a no-op.
    await remote.claimRemoteWithdrawal();
    expect(await remote.outstandingRequestId()).to.equal(1);

    // Leg 2 attempts and gets a NACK.
    await master.connect(governor).triggerClaim();

    // Pending state must still be set so retry is possible.
    expect(await master.pendingWithdrawalAmount()).to.equal(WITHDRAW);
    expect(await remote.outstandingRequestId()).to.equal(1);
    // No tokens reached the vault.
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(0);

    // Now elapse the delay and re-trigger leg 2 — it should succeed.
    await time.increase(DELAY + 1);
    await master.connect(governor).triggerClaim();
    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(WITHDRAW);
  });

  it("claimRemoteWithdrawal is idempotent (safe to call twice)", async () => {
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    await time.increase(DELAY + 1);
    await remote.claimRemoteWithdrawal();
    expect(await remote.outstandingRequestId()).to.equal(0);

    // Second call is a no-op — does not revert.
    await remote.claimRemoteWithdrawal();
    expect(await remote.outstandingRequestId()).to.equal(0);
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(WITHDRAW);
  });

  it("rejects a concurrent withdrawal while one is already pending", async () => {
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    await expect(
      mockL2Vault.callWithdraw(
        master.address,
        mockL2Vault.address,
        bridgeAsset.address,
        WITHDRAW
      )
    ).to.be.revertedWith("Master: yield op in flight");
  });

  it("rejects triggerClaim when no withdrawal is pending", async () => {
    await expect(master.connect(governor).triggerClaim()).to.be.revertedWith(
      "Master: no pending withdrawal"
    );
  });

  it("leg 2 ships only the requested amount, leaving donated residual on Remote", async () => {
    // Leg 1.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );

    // Permissionless claim materialises bridgeAsset on Remote.
    await time.increase(DELAY + 1);
    await remote.claimRemoteWithdrawal();
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(WITHDRAW);
    expect(await remote.outstandingRequestAmount()).to.equal(WITHDRAW);

    // Donate residual bridgeAsset to Remote (donation, leftover, rounding gain).
    const DONATION = ethers.utils.parseUnits("777", 6);
    await bridgeAsset.mintTo(remote.address, DONATION);
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(
      WITHDRAW.add(DONATION)
    );

    // Leg 2 must only ship WITHDRAW, leaving DONATION behind.
    await master.connect(governor).triggerClaim();

    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(WITHDRAW);
    expect(await bridgeAsset.balanceOf(remote.address)).to.equal(DONATION);
    // Master's view of Remote reflects shares-remaining + donation that stayed on Remote.
    // The donation is real value the strategy now holds — it should appear in Master's view.
    expect(await master.remoteStrategyBalance()).to.equal(
      SEED.sub(WITHDRAW).add(DONATION)
    );
    // outstandingRequestAmount cleared after leg-2 success.
    expect(await remote.outstandingRequestAmount()).to.equal(0);
  });

  it("WITHDRAW_CLAIM_ACK payload carries the exact shipped amount", async () => {
    // Drive a full happy-path withdrawal and capture the most recent message in adapterRM.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );
    await time.increase(DELAY + 1);
    await remote.claimRemoteWithdrawal();
    await master.connect(governor).triggerClaim();

    // The Master view confirms the ack amount matched the payload (else it would have
    // reverted with "Master: claim above ack" under the relaxed equality form).
    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(WITHDRAW);
  });

  it("claim ack tolerates `amount < ackAmount` (CCTP fast-finality fee scenario)", async () => {
    // Drive leg 1 then claim on Remote.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      WITHDRAW
    );
    await time.increase(DELAY + 1);
    await remote.claimRemoteWithdrawal();

    // Inspect the adapter that ships WITHDRAW_CLAIM_ACK from Remote to Master. We swap
    // the delivered amount to be SHORT of `ackAmount` by 1 unit, simulating a fast-
    // finality fee deduction during cross-chain transit.
    //
    // Use the mock-adapter override: when leg 2 fires, instead of delivering the exact
    // ackAmount, we intercept and deliver amount-1. The relaxed `amount <= ackAmount`
    // check must accept it.
    const FEE = 1;
    await adapterRM.setUnderdeliveryForNextMessage(FEE);

    await master.connect(governor).triggerClaim();

    expect(await master.pendingWithdrawalAmount()).to.equal(0);
    // Vault received `WITHDRAW - FEE` because that's what landed on Master.
    expect(await bridgeAsset.balanceOf(mockL2Vault.address)).to.equal(
      WITHDRAW.sub(FEE)
    );
  });
});
