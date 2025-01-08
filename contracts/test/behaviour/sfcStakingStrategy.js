const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");

const { oethUnits } = require("../helpers");

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
      const delegateAmount = oethUnits("15000");
      await depositTokenAmount(delegateAmount);
      await delegateTokenAmount(delegateAmount, 0, true);
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

  // deposit the depositAmount into the Sonic Staking Strategy
  const depositTokenAmount = async (depositAmount) => {
    const { sonicStakingStrategy, oSonicVaultSigner, wS, clement } =
      await context();

    const wsBalanceBefore = await wS.balanceOf(sonicStakingStrategy.address);

    const strategyBalanceBefore = await sonicStakingStrategy.checkBalance(
      wS.address
    );

    // Transfer some WS to strategy
    await wS
      .connect(clement)
      .transfer(sonicStakingStrategy.address, depositAmount);

    // Call deposit by impersonating the Vault
    const tx = await sonicStakingStrategy
      .connect(oSonicVaultSigner)
      .deposit(wS.address, depositAmount);

    expect(tx)
      .to.emit(sonicStakingStrategy, "Deposit")
      .withArgs(wS.address, AddressZero, depositAmount);

    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore.add(depositAmount),
      "WS not transferred"
    );

    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      strategyBalanceBefore.add(depositAmount),
      "strategy checkBalance not increased"
    );
  };

  // delegate the delegateAmount into the Sonic Special Fee Contract
  const delegateTokenAmount = async (
    delegateAmount,
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
      .delegate(testValidatorIds[validatorIndex], delegateAmount);

    expect(tx)
      .to.emit(sonicStakingStrategy, "Delegated")
      .withArgs(testValidatorIds[validatorIndex], delegateAmount);

    // checkBalance should not change when delegating
    expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
      contractBalanceBefore,
      "Strategy checkBalance not as expected"
    );

    if (checkBalanceMatchesDelegatedAmount) {
      expect(await sonicStakingStrategy.checkBalance(wS.address)).to.equal(
        delegateAmount,
        "Strategy checkBalance doesn't match delegated amount"
      );
    }

    expect(await wS.balanceOf(sonicStakingStrategy.address)).to.equal(
      wsBalanceBefore.sub(delegateAmount),
      "not the expected WS amount"
    );
  };
};

module.exports = { shouldBehaveLikeASFCStakingStrategy };
