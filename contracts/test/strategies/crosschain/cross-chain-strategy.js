const { expect } = require("chai");
const { isCI } = require("../../helpers");
const {
  createFixtureLoader,
  crossChainFixtureUnit,
} = require("../../_fixture");
const { units } = require("../../helpers");

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
    vault;
  beforeEach(async () => {
    fixture = await loadFixture();
    josh = fixture.josh;
    governor = fixture.governor;
    usdc = fixture.usdc;
    crossChainRemoteStrategy = fixture.crossChainRemoteStrategy;
    crossChainMasterStrategy = fixture.crossChainMasterStrategy;
    vault = fixture.vault;
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

  const mintToMasterDepositToRemote = async (amount) => {
    const { messageTransmitter, morphoVault } = fixture;
    const amountBn = await units(amount, usdc);

    await mint(amount);
    const remoteBalanceBefore = await crossChainRemoteStrategy.checkBalance(
      usdc.address
    );
    const remoteBalanceRecByMasterBefore =
      await crossChainMasterStrategy.remoteStrategyBalance();
    const messagesinQueueBefore = await messageTransmitter.messagesInQueue();
    await depositToMasterStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    // Simulate off chain component processing deposit message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainRemoteStrategy, "Deposit")
      .withArgs(usdc.address, morphoVault.address, amountBn);

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
    const messagesinQueueBefore = await messageTransmitter.messagesInQueue();

    await withdrawFromRemoteStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    await expect(messageTransmitter.processFront())
      // TODO: this event might be removed from the master strategy at some point
      .to.emit(crossChainRemoteStrategy, "Withdrawal")
      .withArgs(usdc.address, morphoVault.address, amountBn);

    await expect(await messageTransmitter.messagesInQueue()).to.eq(
      messagesinQueueBefore + 1
    );

    // master strategy still has the old value fo the remote strategy balance
    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore
    );
    await expect(
      await morphoVault.balanceOf(crossChainRemoteStrategy.address)
    ).to.eq(remoteBalanceBefore - amountBn);
    // Simulate off chain component processing checkBalance message
    await expect(messageTransmitter.processFront())
      .to.emit(crossChainMasterStrategy, "RemoteStrategyBalanceUpdated")
      .withArgs(amountBn);

    await expect(await crossChainMasterStrategy.remoteStrategyBalance()).to.eq(
      remoteBalanceRecByMasterBefore - amountBn
    );
  };

  it("Should mint USDC to master strategy, transfer to remote and update balance", async function () {
    const { morphoVault } = fixture;
    await expect(await morphoVault.totalAssets()).to.eq(await units("0", usdc));
    await mintToMasterDepositToRemote("1000");
    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
  });

  it("Should be able to withdraw from the remote strategy", async function () {
    const { morphoVault } = fixture;
    await mintToMasterDepositToRemote("1000");
    await expect(await morphoVault.totalAssets()).to.eq(
      await units("1000", usdc)
    );
    await withdrawFromRemoteToVault("500");
  });
});
