const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");
const { oethUnits, advanceTime } = require("../helpers");
const { BigNumber } = ethers;
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * @example
    shouldBehaveLikeASFCStakingStrategy(async () => {
    return {
      ...fixture,
      addresses: addresses.sonic,
      sfcAddress: await ethers.getContractAt(
        "ISFC",
        addresses.sonic.SFC
      ),
      // see validators here: https://explorer.soniclabs.com/staking
      testValidatorIds: [16, 18],
    };
  });
 */

const MIN_WITHDRAWAL_EPOCH_ADVANCE = 4;
const shouldBehaveLikeASFCStakingStrategy = (context) => {
  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { sonicStakingStrategy, addresses, oSonicVault, testValidatorIds } =
        await context();
      expect(await sonicStakingStrategy.wrappedSonic()).to.equal(
        addresses.wS,
        "Incorrect wrapped sonic address set"
      );

      expect(await sonicStakingStrategy.sfc()).to.equal(
        addresses.SFC,
        "Incorrect SFC address set"
      );

      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.equal(
        4,
        "Incorrect Supported validators length"
      );

      for (const validatorId of testValidatorIds) {
        expect(
          await sonicStakingStrategy.isSupportedValidator(validatorId)
        ).to.equal(true, "Validator expected to be supported");
      }

      expect(await sonicStakingStrategy.platformAddress()).to.equal(
        addresses.SFC,
        "Incorrect platform address set"
      );

      expect(await sonicStakingStrategy.vaultAddress()).to.equal(
        oSonicVault.address,
        "Incorrect Vault address"
      );

      expect(await sonicStakingStrategy.harvesterAddress()).to.equal(
        AddressZero,
        "Harvester address not empty"
      );

      expect(
        (await sonicStakingStrategy.getRewardTokenAddresses()).length
      ).to.equal(0, "Incorrectly configured Reward Token Addresses");
    });
  });

  describe("Deposit/Delegation", function () {
    it("Should fail when unsupported functions are called", async () => {
      const { sonicStakingStrategy, governor, wS } = await context();

      await expect(
        sonicStakingStrategy
          .connect(governor)
          .setPTokenAddress(wS.address, wS.address)
      ).to.be.revertedWith("unsupported function");

      await expect(
        sonicStakingStrategy.connect(governor).collectRewardTokens()
      ).to.be.revertedWith("unsupported function");

      await expect(
        sonicStakingStrategy.connect(governor).removePToken(wS.address)
      ).to.be.revertedWith("unsupported function");
    });

    it("Should accept and handle S token allocation", async () => {
      const depositAmount = oethUnits("15000");
      await depositTokenAmount(depositAmount);
    });

    it("Should accept and handle S token allocation and delegation to SFC", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
    });

    it("Should accept and handle S token allocation and delegation to all delegators", async () => {
      const depositAmount = oethUnits("20000");
      const delegateAmount = oethUnits("5000");
      await depositTokenAmount(depositAmount);
      await delegateTokenAmount(delegateAmount, 0);
      await delegateTokenAmount(delegateAmount, 1);
      await delegateTokenAmount(delegateAmount, 2);
      await delegateTokenAmount(delegateAmount, 3);
    });
  });

  describe("Undelegation/Withdrawal", function () {
    it("Should undelegate and withdraw", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      await undelegateTokenAmount(amount, 0);
    });

    it("Should not undelegate with 0 amount", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);

      const { sonicStakingStrategy, validatorRegistrator, testValidatorIds } =
        await context();

      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .undelegate(testValidatorIds[0], oethUnits("0"))
      ).to.be.revertedWith("Must undelegate something");
    });

    it("Should not undelegate more than has been delegated", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);

      const { sonicStakingStrategy, validatorRegistrator, testValidatorIds } =
        await context();

      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .undelegate(testValidatorIds[0], oethUnits("1500000000"))
      ).to.be.revertedWith("Insufficient delegation");
    });

    it("Withdraw what has been delegated", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId = await undelegateTokenAmount(amount, 0);
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, amount);
    });

    it("Can not withdraw too soon", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId = await undelegateTokenAmount(amount, 0);
      await advanceWeek();

      await withdrawFromSFC(
        withdrawalId,
        amount,
        { expectedError: "NotEnoughTimePassed()" }
      );

    });

    it("Can not withdraw with too little epochs passing", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId = await undelegateTokenAmount(amount, 0);
      await advanceWeek();
      await advanceWeek();

      await withdrawFromSFC(
        withdrawalId,
        amount,
        { advanceSufficientEpochs: false, expectedError: "NotEnoughEpochsPassed()" }
      );

    });

    it("Can withdraw multiple times", async () => {
      const amount = oethUnits("15000");
      const smallAmount = oethUnits("5000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId1 = await undelegateTokenAmount(smallAmount, 0);
      const withdrawalId2 = await undelegateTokenAmount(smallAmount, 0);
      const withdrawalId3 = await undelegateTokenAmount(smallAmount, 0);
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId1, smallAmount);
      // skip epoch advancement
      await withdrawFromSFC(withdrawalId2, smallAmount, { skipEpochAdvancement: true });
      // skip epoch advancement
      await withdrawFromSFC(withdrawalId3, smallAmount, { skipEpochAdvancement: true });
    });

    it("Incorrect withdrawal ID should revert", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId = await undelegateTokenAmount(amount, 0);
      await withdrawFromSFC(withdrawalId + 10, amount, {
        skipEpochAdvancement: true,
        expectedRevert: "Invalid withdrawId"
      });
    });

    it("Can not withdraw with the same ID twice", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await delegateTokenAmount(amount, 0, true);
      const withdrawalId = await undelegateTokenAmount(amount, 0);
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, amount);
      await withdrawFromSFC(withdrawalId, amount, {
        skipEpochAdvancement: true,
        expectedRevert: "Already withdrawn"
      });
    });

  });

  // deposit the amount into the Sonic Staking Strategy
  const depositTokenAmount = async (amount) => {
    const { sonicStakingStrategy, oSonicVaultSigner, wS, clement } =
      await context();

    const wsBalanceBefore = await wS.balanceOf(sonicStakingStrategy.address);
    const strategyBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );

    // Transfer some WS to strategy
    await wS.connect(clement).transfer(sonicStakingStrategy.address, amount);

    // Call deposit by impersonating the Vault
    const tx = await sonicStakingStrategy
      .connect(oSonicVaultSigner)
      .deposit(wS.address, amount);

    expect(tx)
      .to.emit(sonicStakingStrategy, "Deposit")
      .withArgs(wS.address, AddressZero, amount);

    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore.add(amount),
      "WS not transferred"
    );

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      strategyBalanceBefore.add(amount),
      "strategy checkBalance not increased"
    );
  };

  // delegate the amount into the Sonic Special Fee Contract
  const delegateTokenAmount = async (
    amount,
    validatorIndex,
    checkBalanceMatchesDelegatedAmount = false
  ) => {
    const { sonicStakingStrategy, validatorRegistrator, testValidatorIds, wS } =
      await context();

    const wsBalanceBefore = await wS.balanceOf(sonicStakingStrategy.address);
    const contractBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );

    const tx = await sonicStakingStrategy
      .connect(validatorRegistrator)
      .delegate(testValidatorIds[validatorIndex], amount);

    expect(tx)
      .to.emit(sonicStakingStrategy, "Delegated")
      .withArgs(testValidatorIds[validatorIndex], amount);

    // checkBalance should not change when delegating
    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      contractBalanceBefore,
      "Strategy checkBalance not as expected"
    );

    if (checkBalanceMatchesDelegatedAmount) {
      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
        amount,
        "Strategy checkBalance doesn't match delegated amount"
      );
    }

    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore.sub(amount),
      "not the expected WS amount"
    );
  };

  // undelegate the amount into the Sonic Special Fee Contract
  const undelegateTokenAmount = async (amount, validatorIndex) => {
    const { sonicStakingStrategy, validatorRegistrator, testValidatorIds, wS } =
      await context();

    const contractBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );
    const expectedWithdrawId = await sonicStakingStrategy.nextWithdrawId();
    const pendingWithdrawalsBefore =
      await sonicStakingStrategy.pendingWithdrawals();

    const tx = await sonicStakingStrategy
      .connect(validatorRegistrator)
      .undelegate(testValidatorIds[validatorIndex], amount);

    expect(tx)
      .to.emit(sonicStakingStrategy, "Undelegated")
      .withArgs(expectedWithdrawId, testValidatorIds[validatorIndex], amount);
    const withdrawal = await sonicStakingStrategy.withdrawals(
      expectedWithdrawId
    );

    expect(withdrawal.validatorId).to.equal(testValidatorIds[validatorIndex]);
    expect(withdrawal.undelegatedAmount).to.equal(amount);

    await expect(await sonicStakingStrategy.pendingWithdrawals()).to.equal(
      pendingWithdrawalsBefore.add(amount)
    );

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      contractBalanceBefore,
      "Strategy checkBalance doesn't match"
    );

    return expectedWithdrawId;
  };

  // Withdraw the matured undelegated funds from the Sonic Special Fee Contract
  const withdrawFromSFC = async (
    withdrawalId,
    expectedAmountToWithdraw,
      {
        advanceSufficientEpochs = true,
        skipEpochAdvancement = false,
        expectedError = false,
        expectedRevert = false
      } = {}
    ) => {
    const {
      sonicStakingStrategy,
      validatorRegistrator,
      wS,
      oSonicVault,
    } = await context();

    const contractBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );

    const vaultBalanceBefore = await wS.balanceOf(oSonicVault.address);
    const withdrawal = await sonicStakingStrategy.withdrawals(withdrawalId);
    const amountToWithdraw = withdrawal.undelegatedAmount;
    const pendingWithdrawalsBefore =
      await sonicStakingStrategy.pendingWithdrawals();
    if (!expectedError && !expectedRevert) {
      expect(expectedAmountToWithdraw).to.equal(amountToWithdraw);
    }

    if (!skipEpochAdvancement) {
      if (!advanceSufficientEpochs) {
        await advanceSfcEpoch(1);
      } else {
        await advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);
      }
    }

    if (expectedError) {
      await expect(sonicStakingStrategy
        .connect(validatorRegistrator)
        .withdrawFromSFC(withdrawalId)
      ).to.be.revertedWithCustomError(expectedError);
      return;
    } else if (expectedRevert) {
      await expect(sonicStakingStrategy
        .connect(validatorRegistrator)
        .withdrawFromSFC(withdrawalId)
      ).to.be.revertedWith(expectedRevert);
      return;
    }

    // checkBalance should be smaller by withdrawn amount
    const tx = await sonicStakingStrategy
      .connect(validatorRegistrator)
      .withdrawFromSFC(withdrawalId);

    const withdrawalAfter = await sonicStakingStrategy.withdrawals(
      withdrawalId
    );

    expect(tx)
      .to.emit(sonicStakingStrategy, "Withdrawn")
      .withArgs(
        withdrawalId,
        withdrawal.validatorId,
        amountToWithdraw,
        amountToWithdraw
      );

    expect(await wS.balanceOf(oSonicVault.address)).to.equal(
      vaultBalanceBefore.add(amountToWithdraw)
    );
    expect(withdrawalAfter.undelegatedAmount).to.equal(oethUnits("0"));

    expect(await sonicStakingStrategy.pendingWithdrawals()).to.equal(
      pendingWithdrawalsBefore.sub(amountToWithdraw),
      "Pending withdrawals not reduced by expected amount"
    );

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      contractBalanceBefore.sub(amountToWithdraw),
      "Strategy checkBalance not reduced by expected amount"
    );
  };

  // const advanceDay = async () => {
  //   await advanceTime(60 * 60 * 24);
  // };

  const advance10min = async () => {
    await advanceTime(60 * 10);
  };

  const advanceWeek = async () => {
    await advanceTime(60 * 60 * 24 * 7);
  };

  const advanceSfcEpoch = async (epochsToAdvance) => {
    const { sfc, addresses } = await context();
    const currentSealedEpoch = await sfc.currentSealedEpoch();
    const epochValidators = await sfc.getEpochValidatorIDs(currentSealedEpoch);
    const validatorsLength = (epochValidators).length;

    const nodeDriverAuthSigner = await impersonateAndFund(
      addresses.nodeDriveAuth
    );

    console.log(`Preparing to seal ${epochsToAdvance} epoch(s) on Sonic`);
    for (let i = 0; i < epochsToAdvance; i++) {
      // create array filled with 0s
      const offlineTimes = Array.from(Array(validatorsLength).keys()).fill(
        BigNumber.from("0")
      );
      const offlineBlocks = offlineTimes;
      const uptimes = Array.from(Array(validatorsLength).keys()).fill(
        BigNumber.from("600")
      );
      const originatedTxsFee = Array.from(Array(validatorsLength).keys()).fill(
        BigNumber.from("2955644249909388016706")
      );
      await advance10min();
      await sfc
        .connect(nodeDriverAuthSigner)
        .sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFee);
      await sfc
        .connect(nodeDriverAuthSigner)
        .sealEpochValidators(epochValidators);
    }
  };
};

module.exports = { shouldBehaveLikeASFCStakingStrategy };
