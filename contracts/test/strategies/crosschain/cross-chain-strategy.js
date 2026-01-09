const { expect } = require("chai");
const { isCI, ousdUnits } = require("../../helpers");
const {
  createFixtureLoader,
  crossChainFixtureUnit,
} = require("../../_fixture");
const { units } = require("../../helpers");
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
  const withdrawFromRemoteStrategy = async (amount) => {
    await vault
      .connect(governor)
      .withdrawFromStrategy(
        crossChainMasterStrategy.address,
        [usdc.address],
        [await units(amount, usdc)]
      );
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
    ).to.eq(remoteBalanceBefore + amountBn);

    // Simulate off chain component processing checkBalance message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(amountBn);

    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore
    );
    await assertVaultTotalValue(vaultDiffAfterMint);
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore + amountBn
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
        .withArgs(usdc.address, morphoVault.address, amountBn);
    } else {
      await messageTransmitter.processFront();
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
      .to.emit(crossChainRemoteStrategy, "WithdrawFailed")
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
});
