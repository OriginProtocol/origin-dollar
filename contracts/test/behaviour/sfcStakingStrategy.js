const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");
const { parseUnits, formatUnits } = require("ethers/lib/utils");
const { BigNumber } = ethers;

const { oethUnits, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

const log = require("../../utils/logger")("test:sonic:staking");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * @example
    shouldBehaveLikeASFCStakingStrategy(async () => {
    return {
      ...fixture,
      addresses: addresses.sonic,
      sfc: await ethers.getContractAt(
        "ISFC",
        addresses.sonic.SFC
      ),
      // see validators here: https://explorer.soniclabs.com/staking
      testValidatorIds: [16, 18],
      unsupportedValidators: [1,2]
    };
  });
 */

const MIN_WITHDRAWAL_EPOCH_ADVANCE = 4;
const shouldBehaveLikeASFCStakingStrategy = (context) => {
  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const {
        sonicStakingStrategy,
        addresses,
        oSonicVault,
        testValidatorIds,
        wS,
      } = await context();
      expect(await sonicStakingStrategy.wrappedSonic()).to.equal(
        addresses.wS,
        "Incorrect wrapped sonic address set"
      );

      expect(await sonicStakingStrategy.sfc()).to.equal(
        addresses.SFC,
        "Incorrect SFC address set"
      );

      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.equal(
        testValidatorIds.length,
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

      expect(await oSonicVault.priceProvider()).to.not.equal(
        AddressZero,
        "Price provider address not set"
      );

      expect(await oSonicVault.priceUnitMint(wS.address)).to.equal(
        oethUnits("1"),
        "not expected PriceUnitMint"
      );
    });
  });

  describe("Deposit/Delegation", function () {
    it("Should fail when unsupported functions are called", async () => {
      const { sonicStakingStrategy, timelock, wS } = await context();

      await expect(
        sonicStakingStrategy
          .connect(timelock)
          .setPTokenAddress(wS.address, wS.address)
      ).to.be.revertedWith("unsupported function");

      await expect(
        sonicStakingStrategy.connect(timelock).collectRewardTokens()
      ).to.be.revertedWith("unsupported function");

      await expect(
        sonicStakingStrategy.connect(timelock).removePToken(wS.address)
      ).to.be.revertedWith("unsupported function");
    });

    it("Should not be able to deposit unsupported assets", async () => {
      const { sonicStakingStrategy, oSonicVaultSigner, clement } =
        await context();
      const amount = oethUnits("15000");

      await expect(
        sonicStakingStrategy
          .connect(oSonicVaultSigner)
          .deposit(clement.address, amount)
      ).to.be.revertedWith("Unsupported asset");
    });

    it("Should be able to deposit tokens using depositAll", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount, true);
    });

    it("Should accept and handle S token allocation and delegation to SFC", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
    });

    it("Should earn rewards as epochs pass", async () => {
      const { sonicStakingStrategy, wS } = await context();

      const amount = oethUnits("15000");
      await depositTokenAmount(amount);

      const balanceBefore = await sonicStakingStrategy.checkBalance(wS.address);
      await advanceSfcEpoch(1);
      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.be.gt(
        balanceBefore
      );
    });

    it("Should be able to restake the earned rewards", async () => {
      const { sonicStakingStrategy, wS, sfc, testValidatorIds } =
        await context();
      const defaultValidatorId =
        await sonicStakingStrategy.defaultValidatorId();

      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await advanceSfcEpoch(1);

      const stratBalanceBefore = await sonicStakingStrategy.checkBalance(
        wS.address
      );
      const stakeBefore = await sfc.getStake(
        sonicStakingStrategy.address,
        defaultValidatorId
      );

      await sonicStakingStrategy.restakeRewards(testValidatorIds);

      expect(
        await sfc.getStake(sonicStakingStrategy.address, defaultValidatorId)
      ).to.gt(stakeBefore, "No rewards have been restaked");
      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.eq(
        stratBalanceBefore,
        "Strategy balance changed"
      );
    });

    it("Should be able to claim the earned rewards", async () => {
      const {
        sonicStakingStrategy,
        wS,
        testValidatorIds,
        oSonicVault,
        validatorRegistrator,
      } = await context();

      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await advanceSfcEpoch(1);

      const stratBalanceBefore = await sonicStakingStrategy.checkBalance(
        wS.address
      );
      const vaultBalanceBefore = await wS.balanceOf(oSonicVault.address);

      const tx = await sonicStakingStrategy
        .connect(validatorRegistrator)
        .collectRewards(testValidatorIds);

      await expect(tx).to.emittedEvent("Withdrawal", [
        wS.address,
        AddressZero,
        async (amount) => {
          expect(amount).to.gt(0, "No rewards have been claimed");
        },
      ]);

      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.lt(
        stratBalanceBefore,
        "Strategy balance hasn't decreased"
      );

      expect(await wS.balanceOf(oSonicVault.address)).to.gt(
        vaultBalanceBefore,
        "Ws on the Vault hasn't increased"
      );
    });

    it("Can not restake rewards of an unsupported validator", async () => {
      const {
        sonicStakingStrategy,
        unsupportedValidators,
        validatorRegistrator,
      } = await context();

      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await advanceSfcEpoch(1);

      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .restakeRewards(unsupportedValidators)
      ).to.be.revertedWith("Validator not supported");
    });

    it("Should accept and handle S token allocation and delegation to all delegators", async () => {
      const amount = oethUnits("5000");
      await changeDefaultDelegator(15);
      await depositTokenAmount(amount);
      await changeDefaultDelegator(16);
      await depositTokenAmount(amount);
      await changeDefaultDelegator(17);
      await depositTokenAmount(amount);
      await changeDefaultDelegator(18);
      await depositTokenAmount(amount);
    });

    it("Should not allow deposit of 0 amount", async () => {
      const { sonicStakingStrategy, wS, oSonicVaultSigner } = await context();

      await expect(
        sonicStakingStrategy
          .connect(oSonicVaultSigner)
          .deposit(wS.address, oethUnits("0"))
      ).to.be.revertedWith("Must deposit something");
    });
  });

  describe("Undelegation/Withdrawal", function () {
    let defaultValidatorId;
    beforeEach(async () => {
      const { sonicStakingStrategy } = await context();
      const defaultValidatorIdBn =
        await sonicStakingStrategy.defaultValidatorId();
      defaultValidatorId = parseInt(defaultValidatorIdBn.toString());
    });

    it("Should not be able to withdraw zero amount", async () => {
      const { sonicStakingStrategy, oSonicVaultSigner, oSonicVault, wS } =
        await context();

      await expect(
        sonicStakingStrategy
          .connect(oSonicVaultSigner)
          .withdraw(oSonicVault.address, wS.address, oethUnits("0"))
      ).to.be.revertedWith("Must withdraw something");
    });

    it("Should not be able to withdraw without specifying a recipient", async () => {
      const { sonicStakingStrategy, oSonicVaultSigner, wS } = await context();

      await expect(
        sonicStakingStrategy
          .connect(oSonicVaultSigner)
          .withdraw(AddressZero, wS.address, oethUnits("150"))
      ).to.be.revertedWith("Must specify recipient");
    });

    it("Should not be able to withdraw unsupported assets", async () => {
      const { sonicStakingStrategy, oSonicVaultSigner, oSonicVault, clement } =
        await context();
      const amount = oethUnits("15000");

      await expect(
        sonicStakingStrategy
          .connect(oSonicVaultSigner)
          .withdraw(oSonicVault.address, clement.address, amount)
      ).to.be.revertedWith("Unsupported asset");
    });

    it("Should be able to withdraw undelegated funds", async () => {
      const amount = oethUnits("15000");
      await withdrawUndelegatedAmount(amount);
    });

    it("Should be able to withdrawAll undelegated funds", async () => {
      const amount = oethUnits("15000");
      await withdrawUndelegatedAmount(amount, true);
    });

    it("Should undelegate and withdraw", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      await undelegateTokenAmount(amount, defaultValidatorId);
    });

    it("Should undelegate when unsupporting a validator with delegated funds", async () => {
      const { sfc, sonicStakingStrategy, timelock } = await context();

      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const expectedWithdrawId = await sonicStakingStrategy.nextWithdrawId();

      const stakedAmount = await sfc.getStake(
        sonicStakingStrategy.address,
        defaultValidatorId
      );

      const tx = await sonicStakingStrategy
        .connect(timelock)
        .unsupportValidator(defaultValidatorId);

      await expect(tx)
        .to.emit(sonicStakingStrategy, "Undelegated")
        .withArgs(expectedWithdrawId, defaultValidatorId, stakedAmount);
    });

    it("Should not undelegate with 0 amount", async () => {
      const { sonicStakingStrategy, validatorRegistrator } = await context();
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);

      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .undelegate(defaultValidatorId, oethUnits("0"))
      ).to.be.revertedWith("Must undelegate something");
    });

    it("Should not undelegate more than has been delegated", async () => {
      const { sonicStakingStrategy, validatorRegistrator } = await context();
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);

      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .undelegate(defaultValidatorId, oethUnits("1500000000"))
      ).to.be.revertedWith("Insufficient delegation");
    });

    it("Withdraw what has been delegated", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const withdrawalId = await undelegateTokenAmount(
        amount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, amount);
    });

    it("Withdraw after being partially slashed", async () => {
      const withdrawAmount = oethUnits("15000");
      const slashingRefundRatio = parseUnits("95", 16); // Slashed by 5%
      await depositTokenAmount(withdrawAmount);
      const withdrawalId = await undelegateTokenAmount(
        withdrawAmount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, withdrawAmount, {
        slashingRefundRatio,
      });
    });

    it("Withdraw after being fully slashed", async () => {
      const withdrawAmount = oethUnits("15000");
      const slashingRefundRatio = parseUnits("0", 16); // Slashed 100%
      await depositTokenAmount(withdrawAmount);
      const withdrawalId = await undelegateTokenAmount(
        withdrawAmount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, withdrawAmount, {
        slashingRefundRatio,
      });
    });

    it("Can not withdraw too soon", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const withdrawalId = await undelegateTokenAmount(
        amount,
        defaultValidatorId
      );
      await advanceWeek();

      await withdrawFromSFC(withdrawalId, amount, {
        expectedError: "NotEnoughTimePassed()",
      });
    });

    it("Can not withdraw with too little epochs passing", async () => {
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const withdrawalId = await undelegateTokenAmount(
        amount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();

      await withdrawFromSFC(withdrawalId, amount, {
        advanceSufficientEpochs: false,
        expectedError: "NotEnoughEpochsPassed()",
      });
    });

    it("Can withdraw multiple times", async () => {
      const amount = oethUnits("15000");
      const smallAmount = oethUnits("5000");
      await depositTokenAmount(amount);
      const withdrawalId1 = await undelegateTokenAmount(
        smallAmount,
        defaultValidatorId
      );
      const withdrawalId2 = await undelegateTokenAmount(
        smallAmount,
        defaultValidatorId
      );
      const withdrawalId3 = await undelegateTokenAmount(
        smallAmount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId1, smallAmount);
      // skip epoch advancement
      await withdrawFromSFC(withdrawalId2, smallAmount, {
        skipEpochAdvancement: true,
      });
      // skip epoch advancement
      await withdrawFromSFC(withdrawalId3, smallAmount, {
        skipEpochAdvancement: true,
      });
    });

    it("Incorrect withdrawal ID should revert", async () => {
      const { sonicStakingStrategy } = await context();
      const defaultValidatorId =
        await sonicStakingStrategy.defaultValidatorId();
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const withdrawalId = await undelegateTokenAmount(
        amount,
        defaultValidatorId
      );
      await withdrawFromSFC(withdrawalId + 10, amount, {
        skipEpochAdvancement: true,
        expectedRevert: "Invalid withdrawId",
      });
    });

    it("Can not withdraw with the same ID twice", async () => {
      const { sonicStakingStrategy } = await context();
      const defaultValidatorId =
        await sonicStakingStrategy.defaultValidatorId();
      const amount = oethUnits("15000");
      await depositTokenAmount(amount);
      const withdrawalId = await undelegateTokenAmount(
        amount,
        defaultValidatorId
      );
      await advanceWeek();
      await advanceWeek();
      await withdrawFromSFC(withdrawalId, amount);
      await withdrawFromSFC(withdrawalId, amount, {
        skipEpochAdvancement: true,
        expectedRevert: "Already withdrawn",
      });
    });
  });

  describe("Miscellaneous functions", function () {
    it("Check balance should now be affected if S is sent to the strategy contract", async () => {
      const { sonicStakingStrategy, wS, clement } = await context();

      const sBalanceBefore = await wS.provider.getBalance(
        sonicStakingStrategy.address
      );
      const strategyBalance = await sonicStakingStrategy.checkBalance(
        wS.address
      );

      await wS
        .connect(clement)
        .withdrawTo(sonicStakingStrategy.address, oethUnits("100"));

      expect(await wS.provider.getBalance(sonicStakingStrategy.address)).to.gt(
        sBalanceBefore,
        "S Balance not increased"
      );

      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
        strategyBalance,
        "CheckBalance value changed"
      );
    });

    // WrappedSonic still has the withdrawTo function which anyone can use to
    // unwrap their own S and send it to the sonicStakingStrategy
    it("Should not receive S tokens from non allowed accounts", async () => {
      const { sonicStakingStrategy, clement } = await context();

      await expect(
        clement.sendTransaction({
          to: sonicStakingStrategy.address,
          value: oethUnits("1"),
        })
      ).to.be.revertedWith("S not from allowed contracts");
    });
  });

  const changeDefaultDelegator = async (validatorId) => {
    const { sonicStakingStrategy, strategist } = await context();

    await sonicStakingStrategy
      .connect(strategist)
      .setDefaultValidatorId(validatorId);
  };

  // deposit the amount into the Sonic Staking Strategy
  const depositTokenAmount = async (amount, useDepositAll = false) => {
    const { sonicStakingStrategy, oSonicVaultSigner, wS, clement } =
      await context();

    const defaultValidatorId = await sonicStakingStrategy.defaultValidatorId();
    const strategyBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );
    const wsBalanceBefore = await wS.balanceOf(sonicStakingStrategy.address);

    // Transfer some WS to strategy
    await wS.connect(clement).transfer(sonicStakingStrategy.address, amount);

    // Call deposit by impersonating the Vault
    let tx;
    if (useDepositAll) {
      tx = await sonicStakingStrategy.connect(oSonicVaultSigner).depositAll();
    } else {
      tx = await sonicStakingStrategy
        .connect(oSonicVaultSigner)
        .deposit(wS.address, amount);
    }

    await expect(tx)
      .to.emit(sonicStakingStrategy, "Deposit")
      .withArgs(wS.address, AddressZero, amount);
    await expect(tx)
      .to.emit(sonicStakingStrategy, "Delegated")
      .withArgs(defaultValidatorId, amount);

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      strategyBalanceBefore.add(amount),
      "strategy checkBalance not increased"
    );
    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore,
      "Unexpected WS amount"
    );
  };

  // test that withdraw and withdrawAll remove WS funds from the strategy
  const withdrawUndelegatedAmount = async (amount, useWithdrawAll = false) => {
    const {
      sonicStakingStrategy,
      oSonicVaultSigner,
      wS,
      clement,
      oSonicVault,
    } = await context();

    const strategyBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );
    const wsBalanceBefore = await wS.balanceOf(sonicStakingStrategy.address);

    // Transfer some WS to strategy
    await wS.connect(clement).transfer(sonicStakingStrategy.address, amount);

    if (useWithdrawAll) {
      // Call withdrawAll by impersonating the Vault
      await sonicStakingStrategy.connect(oSonicVaultSigner).withdrawAll();
    } else {
      // Call withdraw by impersonating the Vault
      await sonicStakingStrategy
        .connect(oSonicVaultSigner)
        .withdraw(oSonicVault.address, wS.address, amount);
    }

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      strategyBalanceBefore,
      "strategy checkBalance changed"
    );
    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore,
      "Unexpected WS amount"
    );
  };

  // undelegate the amount into the Sonic Special Fee Contract
  const undelegateTokenAmount = async (amount, validatorId) => {
    const { sonicStakingStrategy, validatorRegistrator, wS } = await context();

    const contractBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );
    const expectedWithdrawId = await sonicStakingStrategy.nextWithdrawId();
    const pendingWithdrawalsBefore =
      await sonicStakingStrategy.pendingWithdrawals();

    const tx = await sonicStakingStrategy
      .connect(validatorRegistrator)
      .undelegate(validatorId, amount);

    await expect(tx)
      .to.emit(sonicStakingStrategy, "Undelegated")
      .withArgs(expectedWithdrawId, validatorId, amount);
    const withdrawal = await sonicStakingStrategy.withdrawals(
      expectedWithdrawId
    );

    expect(withdrawal.validatorId).to.equal(validatorId);
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
    amountToWithdraw,
    {
      advanceSufficientEpochs = true,
      skipEpochAdvancement = false,
      expectedError = false,
      expectedRevert = false,
      slashingRefundRatio = parseUnits("1", 18),
    } = {}
  ) => {
    const { sonicStakingStrategy, validatorRegistrator, wS, oSonicVault } =
      await context();

    if (slashingRefundRatio.lt(parseUnits("1", 18))) {
      await slashValidator(slashingRefundRatio);
    }
    const slashedWithdrawAmount = slashingRefundRatio.eq(0)
      ? slashingRefundRatio
      : amountToWithdraw.mul(slashingRefundRatio).div(parseUnits("1", 18));

    const contractBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );

    const vaultBalanceBefore = await wS.balanceOf(oSonicVault.address);
    const withdrawal = await sonicStakingStrategy.withdrawals(withdrawalId);
    const pendingWithdrawalsBefore =
      await sonicStakingStrategy.pendingWithdrawals();
    if (!expectedError && !expectedRevert) {
      expect(withdrawal.undelegatedAmount).to.equal(amountToWithdraw);
    }

    if (!skipEpochAdvancement) {
      if (!advanceSufficientEpochs) {
        await advanceSfcEpoch(1);
      } else {
        await advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);
      }
    }

    if (expectedError) {
      await expect(
        sonicStakingStrategy
          .connect(validatorRegistrator)
          .withdrawFromSFC(withdrawalId)
      ).to.be.revertedWithCustomError(expectedError);
      return;
    } else if (expectedRevert) {
      await expect(
        sonicStakingStrategy
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

    if (slashedWithdrawAmount.gt(0)) {
      await expect(tx).to.emittedEvent("Withdrawal", [
        wS.address,
        AddressZero,
        async (amount) => {
          expect(amount).to.be.withinRange(
            slashedWithdrawAmount.sub(1),
            slashedWithdrawAmount,
            "Withdrawal event's amount not within dust amount"
          );
        },
      ]);
    }

    await expect(tx).to.emittedEvent("Withdrawn", [
      withdrawalId,
      withdrawal.validatorId,
      amountToWithdraw,
      async (amount) => {
        expect(amount).to.be.withinRange(
          slashedWithdrawAmount.sub(1),
          slashedWithdrawAmount,
          "Withdrawn event's withdrawnAmount not within dust amount"
        );
      },
    ]);

    expect(await wS.balanceOf(oSonicVault.address))
      .to.lte(vaultBalanceBefore.add(slashedWithdrawAmount))
      .gte(vaultBalanceBefore.add(slashedWithdrawAmount.sub(1)));
    expect(withdrawalAfter.undelegatedAmount).to.equal(oethUnits("0"));

    expect(await sonicStakingStrategy.pendingWithdrawals()).to.equal(
      pendingWithdrawalsBefore.sub(amountToWithdraw),
      "Pending withdrawals not reduced by expected amount"
    );

    // the strategy will keep yielding so the balance can be higher
    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.gte(
      contractBalanceBefore.sub(amountToWithdraw),
      "Strategy checkBalance reduced by too much"
    );
  };

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
    const validatorsLength = epochValidators.length;

    const nodeDriverAuthSigner = await impersonateAndFund(
      addresses.nodeDriveAuth
    );

    log(`Preparing to seal ${epochsToAdvance} epoch(s) on Sonic`);
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
      log(`Sealing epoch with ${validatorsLength} validators`);
      await sfc
        .connect(nodeDriverAuthSigner)
        .sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFee);
      await sfc
        .connect(nodeDriverAuthSigner)
        .sealEpochValidators(epochValidators);
    }
  };

  // Slash the default validator
  const slashValidator = async (slashingRefundRatio) => {
    const { addresses, sonicStakingStrategy, sfc } = await context();

    log(
      `Slashing the default validator with a refund ratio of ${formatUnits(
        slashingRefundRatio
      )}`
    );

    const defaultValidatorId = await sonicStakingStrategy.defaultValidatorId();
    const nodeDriverAuthSigner = await impersonateAndFund(
      addresses.nodeDriveAuth
    );
    await sfc
      .connect(nodeDriverAuthSigner)
      .deactivateValidator(defaultValidatorId, "128");
    expect(await sfc.isSlashed(defaultValidatorId)).to.equal(
      true,
      "Not slashed"
    );

    const sfcOwner = await sfc.owner();
    const sfcOwnerSigner = await impersonateAndFund(sfcOwner);
    await sfc
      .connect(sfcOwnerSigner)
      .updateSlashingRefundRatio(defaultValidatorId, slashingRefundRatio);
    expect(await sfc.slashingRefundRatio(defaultValidatorId)).to.equal(
      slashingRefundRatio,
      "slashingRefundRatio"
    );
  };
};

module.exports = { shouldBehaveLikeASFCStakingStrategy };
