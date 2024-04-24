const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");

const {
  createFixtureLoader,
  nativeStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(nativeStakingSSVStrategyFixture);

describe("Unit test: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.nativeStakingSSVStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    harvester: fixture.oethHarvester,
    strategy: fixture.nativeStakingSSVStrategy,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.nativeStakingSSVStrategy,
    assets: [fixture.weth],
    valueAssets: [],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  describe("Initial setup", function () {
    it("Should not allow ETH to be sent to the strategy if not Fee Accumulator", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      const signer = nativeStakingSSVStrategy.provider.getSigner(
        strategist.address
      );
      const tx = {
        to: nativeStakingSSVStrategy.address,
        value: parseEther("2", "ether"),
      };

      await expect(signer.sendTransaction(tx)).to.be.revertedWith(
        "eth not sent from Fee Accumulator"
      );
    });

    it("SSV network should have allowance to spend SSV tokens of the strategy", async () => {
      const { nativeStakingSSVStrategy, ssv } = fixture;

      const ssvNetworkAddress =
        await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS();
      await expect(
        await ssv.allowance(nativeStakingSSVStrategy.address, ssvNetworkAddress)
      ).to.equal(MAX_UINT256);
    });
  });

  describe("Configuring the strategy", function () {
    it("Governor should be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setRegistrator(strategist.address);

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "RegistratorChanged")
        .withArgs(strategist.address);
    });

    it("Non governor should not be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setRegistrator(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Non governor should not be able to update the fuse intervals", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setFuseInterval(parseEther("21.6"), parseEther("25.6"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Fuse interval start needs to be larger than fuse end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("25.6"), parseEther("21.6"))
      ).to.be.revertedWith("incorrect fuse interval");
    });

    it("There should be at least 4 ETH between interval start and interval end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("21.6"), parseEther("25.5"))
      ).to.be.revertedWith("incorrect fuse interval");
    });

    it("Revert when fuse intervals are larger than 32 ether", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("32.1"), parseEther("32.1"))
      ).to.be.revertedWith("incorrect fuse interval");
    });

    it("Governor should be able to change fuse interval", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      const fuseStartBn = parseEther("22.6");
      const fuseEndBn = parseEther("26.6");

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(fuseStartBn, fuseEndBn);

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "FuseIntervalUpdated")
        .withArgs(fuseStartBn, fuseEndBn);
    });

    it("Only accounting governor can call accounting", async () => {});

    it("Only governor can change the accounting governor", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setAccountingGovernor(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Change the accounting governor", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setAccountingGovernor(strategist.address);

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingGovernorChanged")
        .withArgs(strategist.address);
    });
  });

  describe("Accounting", function () {
    // fuseStart 21.6
    // fuseEnd 25.6

    const testCases = [
      // no new rewards
      {
        ethBalance: 0,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // no new rewards on previous rewards
      {
        ethBalance: 0.001,
        previousConsensusRewards: 0.001,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // invalid eth balance
      {
        ethBalance: 1.9,
        previousConsensusRewards: 2,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // tiny consensus rewards
      {
        ethBalance: 0.001,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0.001,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // tiny consensus rewards on small previous rewards
      {
        ethBalance: 0.03,
        previousConsensusRewards: 0.02,
        expectedConsensusRewards: 0.01,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // tiny consensus rewards on large previous rewards
      {
        ethBalance: 5.04,
        previousConsensusRewards: 5,
        expectedConsensusRewards: 0.04,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // large consensus rewards
      {
        ethBalance: 14,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 14,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // just under fuse start
      {
        ethBalance: 21.5,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 21.5,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // exactly fuse start
      {
        ethBalance: 21.6,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // fuse blown
      {
        ethBalance: 22,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // just under fuse end
      {
        ethBalance: 25.5,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // exactly fuse end
      {
        ethBalance: 25.6,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // just over fuse end
      {
        ethBalance: 25.7,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // 1 validator slashed
      {
        ethBalance: 26.6,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // no consensus rewards, 1 slashed validator
      {
        ethBalance: 31.9,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // no consensus rewards, 1 validator fully withdrawn
      {
        ethBalance: 32,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: false,
      },
      // tiny consensus rewards + 1 withdrawn validator
      {
        ethBalance: 32.01,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0.01,
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: false,
      },
      // consensus rewards on previous rewards > 32
      {
        ethBalance: 33,
        previousConsensusRewards: 32.3,
        expectedConsensusRewards: 0.7,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // large consensus rewards + 1 withdrawn validator
      {
        ethBalance: 34,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 2,
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: false,
      },
      // large consensus rewards on large previous rewards
      {
        ethBalance: 44,
        previousConsensusRewards: 24,
        expectedConsensusRewards: 20,
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // fuse blown + 1 withdrawn validator
      {
        ethBalance: 54,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: true,
      },
      // 1 validator fully withdrawn + 1 slashed
      {
        ethBalance: 58.6, // 26.6 + 32
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: true,
        fuseBlown: false,
      },
      // 2 full withdraws
      {
        ethBalance: 64,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0,
        expectedValidatorsFullWithdrawals: 2,
        slashDetected: false,
        fuseBlown: false,
      },
      // tiny consensus rewards + 2 withdrawn validators
      {
        ethBalance: 64.1,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 0.1,
        expectedValidatorsFullWithdrawals: 2,
        slashDetected: false,
        fuseBlown: false,
      },
      // 8 withdrawn validators + consensus rewards
      {
        ethBalance: 276,
        previousConsensusRewards: 0,
        expectedConsensusRewards: 20,
        expectedValidatorsFullWithdrawals: 8,
        slashDetected: false,
        fuseBlown: false,
      },
    ];

    for (const testCase of testCases) {
      const { expectedValidatorsFullWithdrawals, slashDetected, fuseBlown } =
        testCase;
      const ethBalance = parseEther(testCase.ethBalance.toString());
      const previousConsensusRewards = parseEther(
        testCase.previousConsensusRewards.toString()
      );
      const expectedConsensusRewards = parseEther(
        testCase.expectedConsensusRewards.toString()
      );

      it(`Expect ${testCase.ethBalance} ETH balance and ${
        testCase.previousConsensusRewards
      } previous consensus rewards will result in ${
        testCase.expectedConsensusRewards
      } consensus rewards, ${expectedValidatorsFullWithdrawals} withdraws${
        fuseBlown ? ", fuse blown" : ""
      }${slashDetected ? ", slash detected" : ""}.`, async () => {
        const { nativeStakingSSVStrategy, governor, strategist } = fixture;

        // setup state
        if (ethBalance.gt(0)) {
          await setBalance(nativeStakingSSVStrategy.address, ethBalance);
        }
        // pause, so manuallyFixAccounting can be called
        await nativeStakingSSVStrategy.connect(strategist).pause();
        await nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          30, // activeDepositedValidators
          0, //_ethToWeth
          0, //_wethToBeSentToVault
          previousConsensusRewards, //_consensusRewards
          parseEther("3000"), //_ethThresholdCheck
          parseEther("3000") //_wethThresholdCheck
        );

        // check accounting values
        const tx = await nativeStakingSSVStrategy
          .connect(governor)
          .doAccounting();

        if (expectedConsensusRewards.gt(BigNumber.from("0"))) {
          await expect(tx)
            .to.emit(nativeStakingSSVStrategy, "AccountingConsensusRewards")
            .withArgs(expectedConsensusRewards);
        } else {
          await expect(tx).to.not.emit(
            nativeStakingSSVStrategy,
            "AccountingConsensusRewards"
          );
        }

        if (expectedValidatorsFullWithdrawals > 0) {
          await expect(tx)
            .to.emit(
              nativeStakingSSVStrategy,
              "AccountingFullyWithdrawnValidator"
            )
            .withArgs(
              expectedValidatorsFullWithdrawals,
              30 - expectedValidatorsFullWithdrawals,
              parseEther("32").mul(expectedValidatorsFullWithdrawals)
            );
        } else {
          await expect(tx).to.not.emit(
            nativeStakingSSVStrategy,
            "AccountingFullyWithdrawnValidator"
          );
        }

        if (fuseBlown) {
          await expect(tx).to.emit(nativeStakingSSVStrategy, "Paused");
        } else {
          await expect(tx).to.not.emit(nativeStakingSSVStrategy, "Paused");
        }

        if (slashDetected) {
          await expect(tx)
            .to.emit(nativeStakingSSVStrategy, "AccountingValidatorSlashed")
            .withNamedArgs({
              remainingValidators: 30 - expectedValidatorsFullWithdrawals - 1,
            });
        } else {
          await expect(tx).to.not.emit(
            nativeStakingSSVStrategy,
            "AccountingValidatorSlashed"
          );
        }
      });
    }

    it("Only accounting governor is allowed to manually fix accounting", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await nativeStakingSSVStrategy.connect(strategist).pause();
      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          10, //_activeDepositedValidators
          parseEther("2", "ether"), //_ethToWeth
          parseEther("2", "ether"), //_wethToBeSentToVault
          parseEther("2", "ether"), //_consensusRewards
          parseEther("0", "ether"), //_ethThresholdCheck
          parseEther("0", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("Caller is not the Accounting Governor");
    });

    it("Accounting needs to be paused in order to call fix accounting function", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          parseEther("2", "ether"), //_ethToWeth
          parseEther("2", "ether"), //_wethToBeSentToVault
          parseEther("2", "ether"), //_beaconChainRewardWETH
          parseEther("1", "ether"), //_ethThresholdCheck
          parseEther("0", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("not paused");
    });

    it("Should not execute manual recovery if eth threshold reached", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        parseEther("6", "ether")
      );
      await weth
        .connect(josh)
        .transfer(nativeStakingSSVStrategy.address, parseEther("5", "ether"));

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          parseEther("2", "ether"), //_ethToWeth
          parseEther("2", "ether"), //_wethToBeSentToVault
          parseEther("2", "ether"), //_beaconChainRewardWETH
          parseEther("5", "ether"), //_ethThresholdCheck
          parseEther("5", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("over accounting threshold");
    });

    it("Should not execute manual recovery if weth threshold reached", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        parseEther("5", "ether")
      );
      await weth
        .connect(josh)
        .transfer(nativeStakingSSVStrategy.address, parseEther("6", "ether"));

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          parseEther("2", "ether"), //_ethToWeth
          parseEther("2", "ether"), //_wethToBeSentToVault
          parseEther("2", "ether"), //_beaconChainRewardWETH
          parseEther("5", "ether"), //_ethThresholdCheck
          parseEther("5", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("over accounting threshold");
    });

    it("Should allow 5/8 governor to recover paused contract and correct the accounting state", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        parseEther("5", "ether")
      );
      await weth
        .connect(josh)
        .transfer(nativeStakingSSVStrategy.address, parseEther("5", "ether"));

      await nativeStakingSSVStrategy.connect(strategist).pause();
      // unit test fixture sets OUSD governor as accounting governor
      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .manuallyFixAccounting(
          3, //_activeDepositedValidators
          parseEther("2.1", "ether"), //_ethToWeth
          parseEther("2.2", "ether"), //_wethToBeSentToVault
          parseEther("2.3", "ether"), //_beaconChainRewardWETH
          parseEther("5", "ether"), //_ethThresholdCheck
          parseEther("5", "ether") //_wethThresholdCheck
        );

      expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingManuallyFixed")
        .withArgs(
          0, // oldActiveDepositedValidators
          3, // activeDepositedValidators
          0, // oldBeaconChainRewardWETH
          parseEther("2.3"), // beaconChainRewardWETH
          parseEther("2.1"), // ethToWeth
          parseEther("2.2") // wethToBeSentToVault
        );
    });
  });

  describe("General functionality", function () {
    const rewardTestCases = [
      {
        feeAccumulatorEth: 2.2,
        consensusRewards: 16.3,
        deposits: 100,
        nrOfActiveDepositedValidators: 7,
        expectedHarvester: 18.5,
        expectedBalance: 100 + 7 * 32,
      },
      {
        feeAccumulatorEth: 10.2,
        consensusRewards: 21.6,
        deposits: 0,
        nrOfActiveDepositedValidators: 5,
        expectedHarvester: 31.8,
        expectedBalance: 0 + 5 * 32,
      },
      {
        feeAccumulatorEth: 10.2,
        consensusRewards: 21.6,
        deposits: 1,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 31.8,
        expectedBalance: 1 + 0 * 32,
      },
      {
        feeAccumulatorEth: 0,
        consensusRewards: 0,
        deposits: 0,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 0,
        expectedBalance: 0 + 0 * 32,
      },
    ];

    describe("Collecting rewards and should correctly account for WETH", async () => {
      for (const testCase of rewardTestCases) {
        const feeAccumulatorEth = parseEther(
          testCase.feeAccumulatorEth.toString()
        );
        const consensusRewards = parseEther(
          testCase.consensusRewards.toString()
        );
        const deposits = parseEther(testCase.deposits.toString());
        const expectedHarvester = parseEther(
          testCase.expectedHarvester.toString()
        );

        it(`with ${testCase.feeAccumulatorEth} execution rewards, ${testCase.consensusRewards} consensus rewards and ${testCase.deposits} deposits. expect harvest ${testCase.expectedHarvester}`, async () => {
          const {
            nativeStakingSSVStrategy,
            governor,
            oethHarvester,
            weth,
            josh,
          } = fixture;
          const feeAccumulatorAddress =
            await nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS();
          const sHarvester = await impersonateAndFund(oethHarvester.address);

          // setup state
          if (consensusRewards.gt(BigNumber.from("0"))) {
            // set the reward eth on the strategy
            await setBalance(
              nativeStakingSSVStrategy.address,
              consensusRewards
            );
          }
          if (feeAccumulatorEth.gt(BigNumber.from("0"))) {
            // set execution layer rewards on the fee accumulator
            await setBalance(feeAccumulatorAddress, feeAccumulatorEth);
          }
          if (deposits.gt(BigNumber.from("0"))) {
            // send eth to the strategy as if Vault would send it via a Deposit function
            await weth
              .connect(josh)
              .transfer(nativeStakingSSVStrategy.address, deposits);
          }

          // run the accounting
          await nativeStakingSSVStrategy.connect(governor).doAccounting();

          const harvesterWethBalance = await weth.balanceOf(
            oethHarvester.address
          );
          const tx = await nativeStakingSSVStrategy
            .connect(sHarvester)
            .collectRewardTokens();

          if (expectedHarvester.gt(BigNumber.from("0"))) {
            await expect(tx)
              .to.emit(nativeStakingSSVStrategy, "RewardTokenCollected")
              .withArgs(oethHarvester.address, weth.address, expectedHarvester);
          } else {
            await expect(tx).to.not.emit(
              nativeStakingSSVStrategy,
              "RewardTokenCollected"
            );
          }

          const harvesterBalanceDiff = (
            await weth.balanceOf(oethHarvester.address)
          ).sub(harvesterWethBalance);
          expect(harvesterBalanceDiff).to.equal(expectedHarvester);
        });
      }
    });

    describe("Checking balance should return the correct values", async () => {
      for (const testCase of rewardTestCases) {
        const feeAccumulatorEth = parseEther(
          testCase.feeAccumulatorEth.toString()
        );
        const consensusRewards = parseEther(
          testCase.consensusRewards.toString()
        );
        const deposits = parseEther(testCase.deposits.toString());
        const expectedBalance = parseEther(testCase.expectedBalance.toString());
        const { nrOfActiveDepositedValidators } = testCase;
        it(`with ${testCase.feeAccumulatorEth} execution rewards, ${testCase.consensusRewards} consensus rewards, ${testCase.deposits} deposits and ${nrOfActiveDepositedValidators} validators. expected balance ${testCase.expectedBalance}`, async () => {
          const {
            nativeStakingSSVStrategy,
            governor,
            strategist,
            // oethHarvester,
            weth,
            josh,
          } = fixture;
          const feeAccumulatorAddress =
            await nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS();

          // setup state
          if (consensusRewards.gt(BigNumber.from("0"))) {
            // set the reward eth on the strategy
            await setBalance(
              nativeStakingSSVStrategy.address,
              consensusRewards
            );
          }
          if (feeAccumulatorEth.gt(BigNumber.from("0"))) {
            // set execution layer rewards on the fee accumulator
            await setBalance(feeAccumulatorAddress, feeAccumulatorEth);
          }
          if (deposits.gt(BigNumber.from("0"))) {
            // send eth to the strategy as if Vault would send it via a Deposit function
            await weth
              .connect(josh)
              .transfer(nativeStakingSSVStrategy.address, deposits);
          }

          // set the correct amount of staked validators
          await nativeStakingSSVStrategy.connect(strategist).pause();
          await nativeStakingSSVStrategy
            .connect(governor)
            .manuallyFixAccounting(
              nrOfActiveDepositedValidators, // activeDepositedValidators
              parseEther("0", "ether"), //_ethToWeth
              parseEther("0", "ether"), //_wethToBeSentToVault
              parseEther("0", "ether"), //_beaconChainRewardWETH
              parseEther("3000", "ether"), //_ethThresholdCheck
              parseEther("3000", "ether") //_wethThresholdCheck
            );

          // run the accounting
          await nativeStakingSSVStrategy.connect(governor).doAccounting();

          expect(
            await nativeStakingSSVStrategy.checkBalance(weth.address)
          ).to.equal(expectedBalance);
        });
      }
    });

    it("Should be able to collect the SSV reward token", async () => {});
  });
});
