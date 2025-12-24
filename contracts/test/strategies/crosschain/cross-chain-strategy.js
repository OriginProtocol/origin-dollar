const { expect } = require("chai");
const { isCI, ousdUnits } = require("../../helpers");
const {
  createFixtureLoader,
  crossChainFixtureUnit,
} = require("../../_fixture");
const { units } = require("../../helpers");
const addresses = require("../../../utils/addresses");

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
    await crossChainRemoteStrategy.connect(governor).withdraw(
      addresses.zeroAddress, // this gets ignored anyway
      usdc.address,
      await units(amount, usdc)
    );
  };

  // Withdraws all the remote strategy directly, without going through the master strategy
  const directWithdrawAllFromRemoteStrategy = async () => {
    await crossChainRemoteStrategy.connect(governor).withdrawAll();
  };

  // Checks the diff in the total expected value in the vault
  // (plus accompanying strategy value)
  const assetVaultTotalValue = async (amountExpected) => {
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
    await assetVaultTotalValue(vaultDiffAfterMint);

    await depositToMasterStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );
    await assetVaultTotalValue(vaultDiffAfterMint);

    // Simulate off chain component processing deposit message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainRemoteStrategy, "Deposit")
      .withArgs(usdc.address, morphoVault.address, amountBn);

    await assetVaultTotalValue(vaultDiffAfterMint);
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
    await assetVaultTotalValue(vaultDiffAfterMint);
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore + amountBn
    );
  };

  const withdrawFromRemoteToVault = async (amount) => {
    const { messageTransmitter, morphoVault } = fixture;
    const amountBn = await units(amount, usdc);
    const remoteBalanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const remoteBalanceRecByMasterBefore =
      await crossChainMasterStrategy.remoteStrategyBalance();

    // If there is any pre-existing USDC balance on the remote strategy it will get swept up by the next
    // withdrawal
    const usdcBalanceOnRemoteStrategyBefore = await usdc.balanceOf(
      crossChainRemoteStrategy.address
    );
    const messagesinQueueBefore = await messageTransmitter.messagesInQueue();

    await withdrawFromRemoteStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    await expect(messageTransmitter.processFront())
      .to.emit(crossChainRemoteStrategy, "Withdrawal")
      .withArgs(usdc.address, morphoVault.address, amountBn);

    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    // master strategy still has the old value fo the remote strategy balance
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore
    );

    const remoteBalanceAfter =
      remoteBalanceBefore - amountBn - usdcBalanceOnRemoteStrategyBefore;
    await expect(
      await morphoVault.balanceOf(crossChainRemoteStrategy.address)
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
    await assetVaultTotalValue("0");
    await expect(await morphoVault.totalAssets()).to.eq(await units("0", usdc));

    await mintToMasterDepositToRemote("1000");
    await assetVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
  });

  it("Should be able to withdraw from the remote strategy", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assetVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await withdrawFromRemoteToVault("500");
    await assetVaultTotalValue("1000");
  });

  it("Should be able to direct withdraw from the remote strategy direclty", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assetVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await directWithdrawFromRemoteStrategy("500");
    await assetVaultTotalValue("1000");

    // 500 has been withdrawn from the Morpho vault but still remains on the
    // remote strategy
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("1000", usdc));

    // Next withdraw should withdraw additional 10 from the remote strategy and pick up the
    // previous 500 totaling a transfer of 510
    await withdrawFromRemoteToVault("10");

    await assetVaultTotalValue("1000");
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("490", usdc));
  });

  it("Should be able to direct withdraw all from the remote strategy direclty and collect to master", async function () {
    const { morphoVault, messageTransmitter } = fixture;
    await mintToMasterDepositToRemote("1000");
    await assetVaultTotalValue("1000");

    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await directWithdrawAllFromRemoteStrategy();
    await assetVaultTotalValue("1000");

    // All has been withdrawn from the Morpho vault but still remains on the
    // remote strategy
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("1000", usdc));

    // The remote strategy doesn't have anything in the Morpho vault anymore. This
    // withdrawal will thus fail on the vault, but the transactoin receiving all the
    // funds should still succeed.
    await withdrawFromRemoteStrategy("10");
    await expect(messageTransmitter.processFront()).to.emit(
      crossChainRemoteStrategy,
      "WithdrawFailed"
    );
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(await units("0", usdc));

    await assetVaultTotalValue("1000");
    await expect(
      await crossChainRemoteStrategy.checkBalance(usdc.address)
    ).to.eq(await units("0", usdc));
  });
});
