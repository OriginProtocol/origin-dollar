const { expect } = require("chai");
const { isCI, ousdUnits } = require("../../helpers");
const {
  createFixtureLoader,
  crossChainFixtureUnit,
} = require("../../_fixture");
const { setERC20TokenBalance } = require("../../_fund");
const { units, usdcUnits } = require("../../helpers");
const { impersonateAndFund } = require("../../../utils/signers");

const loadFixture = createFixtureLoader(crossChainFixtureUnit);

describe("ForkTest: CrossChainRemoteStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture,
    josh,
    governor,
    usdc,
    crossChainRemoteStrategy,
    crossChainMasterStrategy,
    vault,
    initialVaultValue;
  beforeEach(async () => {
    fixture = await loadFixture();
    josh = fixture.josh;
    governor = fixture.governor;
    usdc = fixture.usdc;
    crossChainRemoteStrategy = fixture.crossChainRemoteStrategy;
    crossChainMasterStrategy = fixture.crossChainMasterStrategy;
    vault = fixture.vault;
    initialVaultValue = await vault.totalValue();
  });

  const mint = async (amount) => {
    await usdc.connect(josh).approve(vault.address, await units(amount, usdc));
    await vault.connect(josh).mint(usdc.address, await units(amount, usdc), 0);
  };

  const depositToMasterStrategy = async (amount) => {
    await vault
      .connect(governor)
      .depositToStrategy(
        crossChainMasterStrategy.address,
        [usdc.address],
        [await units(amount, usdc)]
      );
  };

  // Even though remote strategy has funds withdrawn the message initiates on master strategy
  const withdrawFromRemoteStrategy = (amount) => {
    return vault
      .connect(governor)
      .withdrawFromStrategy(
        crossChainMasterStrategy.address,
        [usdc.address],
        [usdcUnits(amount, usdc)]
      );
  };

  const withdrawAllFromRemoteStrategy = () => {
    return vault
      .connect(governor)
      .withdrawAllFromStrategy(crossChainMasterStrategy.address);
  };

  // Withdraws from the remote strategy directly, without going through the master strategy
  const directWithdrawFromRemoteStrategy = async (amount) => {
    await crossChainRemoteStrategy
      .connect(governor)
      .withdraw(
        crossChainRemoteStrategy.address,
        usdc.address,
        await units(amount, usdc)
      );
  };

  // Withdraws all the remote strategy directly, without going through the master strategy
  const directWithdrawAllFromRemoteStrategy = async () => {
    await crossChainRemoteStrategy.connect(governor).withdrawAll();
  };

  const sendBalanceUpdateToMaster = async () => {
    await crossChainRemoteStrategy.connect(governor).sendBalanceUpdate();
  };

  // Checks the diff in the total expected value in the vault
  // (plus accompanying strategy value)
  const assertVaultTotalValue = async (amountExpected) => {
    const amountToCompare =
      typeof amountExpected === "string"
        ? ousdUnits(amountExpected)
        : amountExpected;

    await expect((await vault.totalValue()).sub(initialVaultValue)).to.eq(
      amountToCompare
    );
  };

  const mintToMasterDepositToRemote = async (amount) => {
    const { messageTransmitter, morphoVault } = fixture;
    const amountBn = await units(amount, usdc);

    await mint(amount);
    const vaultDiffAfterMint = (await vault.totalValue()).sub(
      initialVaultValue
    );

    const remoteBalanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const remoteBalanceRecByMasterBefore =
      await crossChainMasterStrategy.remoteStrategyBalance();
    const messagesinQueueBefore = await messageTransmitter.messagesInQueue();
    await assertVaultTotalValue(vaultDiffAfterMint);

    await depositToMasterStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );
    await assertVaultTotalValue(vaultDiffAfterMint);

    // Simulate off chain component processing deposit message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainRemoteStrategy, "Deposit")
      .withArgs(usdc.address, morphoVault.address, amountBn);

    await assertVaultTotalValue(vaultDiffAfterMint);
    // 1 message is processed, another one (checkBalance) has entered the queue
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );
    await expect(
      await morphoVault.balanceOf(crossChainRemoteStrategy.address)
    ).to.eq(remoteBalanceBefore.add(amountBn));

    // Simulate off chain component processing checkBalance message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(remoteBalanceBefore.add(amountBn));

    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore
    );
    await assertVaultTotalValue(vaultDiffAfterMint);
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore.add(amountBn)
    );
  };

  const withdrawFromRemoteToVault = async (amount, expectWithdrawalEvent) => {
    const { messageTransmitter, morphoVault } = fixture;
    const amountBn = await units(amount, usdc);
    const remoteBalanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const remoteBalanceRecByMasterBefore =
      await crossChainMasterStrategy.remoteStrategyBalance();

    const messagesinQueueBefore = await messageTransmitter.messagesInQueue();

    await withdrawFromRemoteStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    if (expectWithdrawalEvent) {
      await expect(messageTransmitter.processFront())
        .to.emit(crossChainRemoteStrategy, "Withdrawal")
        .withArgs(usdc.address, morphoVault.address, amountBn)
        .to.emit(crossChainRemoteStrategy, "TokensBridged");
    } else {
      await expect(messageTransmitter.processFront()).to.emit(
        crossChainRemoteStrategy,
        "TokensBridged"
      );
    }

    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    // master strategy still has the old value fo the remote strategy balance
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore
    );

    const remoteBalanceAfter = remoteBalanceBefore - amountBn;

    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(remoteBalanceAfter);

    // Simulate off chain component processing checkBalance message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(remoteBalanceAfter);

    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceAfter
    );
  };

  it("Should mint USDC to master strategy, transfer to remote and update balance", async function () {
    const { morphoVault } = fixture;
    await assertVaultTotalValue("0");
    await expect(await morphoVault.totalAssets()).to.eq(await units("0", usdc));

    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
  });

  it("Should be able to withdraw from the remote strategy", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await withdrawFromRemoteToVault("500", true);
    await assertVaultTotalValue("1000");
  });

  it("Should be able to direct withdraw from the remote strategy directly and collect to master", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await directWithdrawFromRemoteStrategy("500");
    await assertVaultTotalValue("1000");

    // 500 has been withdrawn from the Morpho vault but still remains on the
    // remote strategy
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("1000", usdc));

    // Next withdraw should not withdraw any additional funds from Morpho and just send
    // 450 USDC to the master.
    await withdrawFromRemoteToVault("450", false);

    await assertVaultTotalValue("1000");
    // The remote strategy should have 500 USDC in Morpho vault and 50 USDC on the contract
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("550", usdc));
    await expect(await usdc.balanceOf(crossChainRemoteStrategy.address)).to.eq(
      await units("50", usdc)
    );
  });

  it("Should be able to direct withdraw from the remote strategy directly and withdrawing More from Morpho when collecting to the master", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await directWithdrawFromRemoteStrategy("500");
    await assertVaultTotalValue("1000");

    // 500 has been withdrawn from the Morpho vault but still remains on the
    // remote strategy
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("1000", usdc));

    // Next withdraw should withdraw 50 additional funds and send them with existing
    // 500 USDC to the master.
    await withdrawFromRemoteToVault("550", false);

    await assertVaultTotalValue("1000");
    // The remote strategy should have 500 USDC in Morpho vault and 50 USDC on the contract
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("450", usdc));
    await expect(await usdc.balanceOf(crossChainRemoteStrategy.address)).to.eq(
      await units("0", usdc)
    );
  });

  it("Should fail when a withdrawal too large is requested", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );

    // Master strategy should prevent withdrawing more than is available in the remote strategy
    await expect(withdrawFromRemoteStrategy("1001")).to.be.revertedWith(
      "Withdraw amount exceeds remote strategy balance"
    );

    await assertVaultTotalValue("1000");
  });

  it("Should be able to direct withdraw all from the remote strategy directly and collect to master", async function () {
    const { morphoVault, messageTransmitter } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await directWithdrawAllFromRemoteStrategy();
    await assertVaultTotalValue("1000");

    // All has been withdrawn from the Morpho vault but still remains on the
    // remote strategy
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("1000", usdc));

    await withdrawFromRemoteStrategy("1000");
    await expect(messageTransmitter.processFront()).not.to.emit(
      crossChainRemoteStrategy,
      "WithdrawUnderlyingFailed"
    );
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(await units("0", usdc));

    await assertVaultTotalValue("1000");
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("0", usdc));
  });

  it("Should fail when a withdrawal too large is requested on the remote strategy", async function () {
    const { messageTransmitter } = fixture;
    const remoteStrategySigner = await impersonateAndFund(
      crossChainRemoteStrategy.address
    );

    await mintToMasterDepositToRemote("1000");
    await assertVaultTotalValue("1000");

    await directWithdrawFromRemoteStrategy("10");

    // Trick the remote strategy into thinking it has 10 USDC more than it actually does
    await usdc
      .connect(remoteStrategySigner)
      .transfer(vault.address, await units("10", usdc));
    // Vault has 10 USDC more & Master strategy still thinks it has 1000 USDC
    await assertVaultTotalValue("1010");

    // This step should fail because the remote strategy no longer holds 1000 USDC
    await withdrawFromRemoteStrategy("1000");

    // Process on remote strategy
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainRemoteStrategy, "WithdrawalFailed")
      .withArgs(await units("1000", usdc), await units("0", usdc));

    // Process on master strategy
    // This event doesn't get triggerred as the master strategy considers the balance check update
    // as a race condition, and is exoecting an "on TokenReceived " to be called instead

    // which also causes the master strategy not to update the balance of the remote strategy
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(await units("990", usdc));

    await expect(await messageTransmitter.messagesInQueue()).to.eq(0);

    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("990", usdc));

    await expect(
      await crossChainMasterStrategy.checkBalance(usdc.address)
    ).to.eq(await units("990", usdc));
  });

  it("Should be able to process withdrawal & checkBalance on Remote strategy and in reverse order on master strategy", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    // Process on remote strategy
    await expect(messageTransmitter.processFront());
    // This sends a second balanceUpdate message to the CCTP bridge
    await sendBalanceUpdateToMaster();

    await expect(await messageTransmitter.messagesInQueue()).to.eq(2);

    // first process the standalone balanceCheck message - meaning we process messages out of order
    // this message should be ignored on Master
    await expect(messageTransmitter.processBack()).to.not.emit(
      crossChainMasterStrategy,
      "RemoteStrategyBalanceUpdated"
    );

    // Second balance update message is part of the deposit / withdrawal process and should be processed
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(await units("700", usdc));

    await expect(await messageTransmitter.messagesInQueue()).to.eq(0);

    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("700", usdc));

    await expect(
      await crossChainMasterStrategy.checkBalance(usdc.address)
    ).to.eq(await units("700", usdc));

    await assertVaultTotalValue("1000");
  });

  it("Should fail on deposit if a previous one has not completed", async function () {
    await mint("100");
    await depositToMasterStrategy("50");

    await expect(depositToMasterStrategy("50")).to.be.revertedWith(
      "Unexpected pending amount"
    );
  });

  it("Should fail to withdraw if a previous deposit has not completed", async function () {
    await mintToMasterDepositToRemote("40");
    await mint("50");
    await depositToMasterStrategy("50");

    await expect(withdrawFromRemoteStrategy("40")).to.be.revertedWith(
      "Pending token transfer"
    );
  });

  it("Should fail on deposit if a previous withdrawal has not completed", async function () {
    await mintToMasterDepositToRemote("230");
    await withdrawFromRemoteStrategy("50");

    await mint("30");
    await expect(depositToMasterStrategy("30")).to.be.revertedWith(
      "Pending token transfer"
    );
  });

  it("Should fail to withdraw if a previous withdrawal has not completed", async function () {
    await mintToMasterDepositToRemote("230");
    await withdrawFromRemoteStrategy("50");

    await expect(withdrawFromRemoteStrategy("40")).to.be.revertedWith(
      "Pending token transfer"
    );
  });

  it("Should fail to deposit non usdc asset", async function () {
    const { ousd, vault, vaultSigner, josh, crossChainMasterStrategy } =
      fixture;
    await mint("10");
    await ousd.connect(josh).transfer(vault.address, await units("10", ousd));
    await expect(
      crossChainMasterStrategy
        .connect(vaultSigner)
        .deposit(ousd.address, await units("10", ousd))
    ).to.be.revertedWith("Unsupported asset");
  });

  it("Should not deposit less than 1 USDC using normal depositAll approach", async function () {
    await mint("1");
    // DepositAll function doesn't call _deposit when amount is less than 1 USDC
    await expect(
      vault
        .connect(governor)
        .depositToStrategy(
          crossChainMasterStrategy.address,
          [usdc.address],
          [await units("0.5", usdc)]
        )
    ).not.to.emit(crossChainMasterStrategy, "Deposit");
  });

  it("Should revert when depositing less than 1 USDC", async function () {
    const { usdc, vaultSigner, crossChainMasterStrategy } = fixture;
    await mint("10");
    await expect(
      crossChainMasterStrategy
        .connect(vaultSigner)
        .deposit(usdc.address, await units("0.5", usdc))
    ).to.be.revertedWith("Deposit amount too small");
  });

  it("Should not calling withdrawAll if one withdraw is pending", async function () {
    await mintToMasterDepositToRemote("10");
    await withdrawFromRemoteStrategy("5");

    // 1 withdraw is pending, the withdrawAll won't issue another withdraw, but wont fail as well
    await expect(withdrawAllFromRemoteStrategy()).to.not.emit(
      crossChainMasterStrategy,
      "WithdrawRequested"
    );
  });

  it("Should not calling withdrawAll when to little balance is on the remote strategy", async function () {
    await mintToMasterDepositToRemote("10");
    await withdrawFromRemoteToVault("9.5", true);

    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(usdcUnits("0.5"));

    // Remote only has 0.5 USDC left, the withdrawAll won't issue another withdraw, but wont fail as well
    await expect(withdrawAllFromRemoteStrategy()).to.not.emit(
      crossChainMasterStrategy,
      "WithdrawRequested"
    );
  });

  it("Should revert if withdrawal amount is too small", async function () {
    await mintToMasterDepositToRemote("10");

    await expect(withdrawFromRemoteStrategy("0.9")).to.be.revertedWith(
      "Withdraw amount too small"
    );
  });

  it("Should revert if withdrawal exceeds remote strategy balance", async function () {
    await mintToMasterDepositToRemote("10");

    await expect(withdrawFromRemoteStrategy("11")).to.be.revertedWith(
      "Withdraw amount exceeds remote strategy balance"
    );
  });

  it("Should revert if withdrawal exceeds max transfer amount", async function () {
    await setERC20TokenBalance(josh.address, usdc, "100000000");
    await mintToMasterDepositToRemote("9000000");
    await mintToMasterDepositToRemote("9000000");

    await expect(withdrawFromRemoteStrategy("10000001")).to.be.revertedWith(
      "Withdraw amount exceeds max transfer amount"
    );
  });

  it("Should revert if balance update on the remote strategy is not called by operator or governor or strategist", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy.connect(josh).sendBalanceUpdate()
    ).to.be.revertedWith(
      "Caller is not the Operator, Strategist or the Governor"
    );
  });

  it("Should revert if deposit on the remote strategy is not called by the governor or strategist", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy
        .connect(josh)
        .deposit(usdc.address, await units("10", usdc))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should revert if depositAll on the remote strategy is not called by the governor or strategist", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy.connect(josh).depositAll()
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should revert if withdraw on the remote strategy is not called by the governor or strategist", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy
        .connect(josh)
        .withdraw(vault.address, usdc.address, await units("10", usdc))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should revert if withdrawAll on the remote strategy is not called by the governor or strategist", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy.connect(josh).withdrawAll()
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should revert if depositing 0 amount", async function () {
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy
        .connect(governor)
        .deposit(usdc.address, await units("0", usdc))
    ).to.be.revertedWith("Must deposit something");
  });

  it("Should revert if not depositing USDC", async function () {
    const { ousd } = fixture;
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy
        .connect(governor)
        .deposit(ousd.address, await units("10", ousd))
    ).to.be.revertedWith("Unexpected asset address");
  });

  it("Check balance on the remote strategy should revert when not passing USDC address", async function () {
    const { ousd } = fixture;
    await mintToMasterDepositToRemote("10");
    await expect(
      crossChainRemoteStrategy.checkBalance(ousd.address)
    ).to.be.revertedWith("Unexpected asset address");
  });

  it("Check balance on the remote strategy should revert when not passing USDC address", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    // Process on remote strategy
    await expect(
      messageTransmitter.processFrontOverrideHeader("0x00000001")
    ).to.be.revertedWith("Unsupported message version");
  });

  it("Should revert if setMinFinalityThreshold does not equal 1000 or 2000", async function () {
    await expect(
      crossChainMasterStrategy.connect(governor).setMinFinalityThreshold(1001)
    ).to.be.revertedWith("Invalid threshold");

    await expect(
      crossChainMasterStrategy.connect(governor).setMinFinalityThreshold(2001)
    ).to.be.revertedWith("Invalid threshold");
  });

  it("Should set min finality threshold to 1000", async function () {
    await crossChainMasterStrategy
      .connect(governor)
      .setMinFinalityThreshold(1000);
    await expect(await crossChainMasterStrategy.minFinalityThreshold()).to.eq(
      1000
    );
  });

  it("Should set min finality threshold to 2000", async function () {
    await crossChainMasterStrategy
      .connect(governor)
      .setMinFinalityThreshold(2000);
    await expect(await crossChainMasterStrategy.minFinalityThreshold()).to.eq(
      2000
    );
  });

  it("Should set fee premium to 1000 bps successfully", async function () {
    const initialFeeBps = await crossChainMasterStrategy.feePremiumBps();
    expect(initialFeeBps).to.equal(0); // Default is 0

    await expect(
      crossChainMasterStrategy.connect(governor).setFeePremiumBps(1000)
    )
      .to.emit(crossChainMasterStrategy, "CCTPFeePremiumBpsSet")
      .withArgs(1000);

    // Verify state updated
    expect(await crossChainMasterStrategy.feePremiumBps()).to.equal(1000);
  });

  it("Should revert when setting fee premium >3000 bps", async function () {
    await expect(
      crossChainMasterStrategy.connect(governor).setFeePremiumBps(3001)
    ).to.be.revertedWith("Fee premium too high");
  });

  it("Should revert if sender of the message is not correct", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    await messageTransmitter.connect(josh).overrideSender(josh.address);
    // Process on remote strategy
    await expect(messageTransmitter.processFront()).to.be.revertedWith(
      "Unknown Sender"
    );
  });

  it("Should revert if unfinalized messages are not supported", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    await messageTransmitter.connect(josh).overrideMessageFinality(1000);
    // Process on remote strategy
    await expect(messageTransmitter.processFront()).to.be.revertedWith(
      "Unfinalized messages are not supported"
    );
  });

  it("Should accept unfinalized messages if min finality threshold is set to 1000", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    await crossChainRemoteStrategy
      .connect(governor)
      .setMinFinalityThreshold(1000);

    await messageTransmitter.connect(josh).overrideMessageFinality(1000);
    // Process on remote strategy
    await messageTransmitter.processFront();
  });

  it("Should revert is message finality is below 1000", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    await crossChainRemoteStrategy
      .connect(governor)
      .setMinFinalityThreshold(1000);

    await messageTransmitter.connect(josh).overrideMessageFinality(999);
    // Process on remote strategy
    await expect(messageTransmitter.processFront()).to.be.revertedWith(
      "Finality threshold too low"
    );
  });

  it("Should revert if the source domain is not correct", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    await messageTransmitter.connect(josh).overrideSourceDomain(444);
    // Process on remote strategy
    await expect(messageTransmitter.processFront()).to.be.revertedWith(
      "Unknown Source Domain"
    );
  });

  it("Should revert if incorrect cctp message version is used", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    // Process on remote strategy
    await expect(
      messageTransmitter.processFrontOverrideVersion(2)
    ).to.be.revertedWith("Invalid CCTP message version");
  });

  it("Should revert if incorrect sender is used in the message header", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    // Process on remote strategy
    await expect(
      messageTransmitter.processFrontOverrideSender(josh.address)
    ).to.be.revertedWith("Incorrect sender/recipient address");
  });

  it("Should revert if incorrect sender is used in the message header", async function () {
    const { messageTransmitter } = fixture;

    await mintToMasterDepositToRemote("1000");

    await withdrawFromRemoteStrategy("300");

    // Process on remote strategy
    await expect(
      messageTransmitter.processFrontOverrideRecipient(josh.address)
    ).to.be.revertedWith("Unexpected recipient address");
  });
});
