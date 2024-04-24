const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { formatUnits, parseEther } = require("ethers").utils;
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
    const testCases = [
      // normal beacon chain rewards
      {
        ethBalance: parseEther("14"),
        expectedRewards: parseEther("14"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // normal beacon chain rewards + 1 withdrawn validator
      {
        ethBalance: parseEther("34"),
        expectedRewards: parseEther("2"),
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: false,
      },
      // 8 withdrawn validators + beacon chain rewards
      {
        ethBalance: parseEther("276"),
        expectedRewards: parseEther("20"),
        expectedValidatorsFullWithdrawals: 8,
        slashDetected: false,
        fuseBlown: false,
      },
      // fuse blown
      {
        ethBalance: parseEther("22"),
        expectedRewards: parseEther("0"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // fuse blown + 1 full withdrawal
      {
        ethBalance: parseEther("54"),
        expectedRewards: parseEther("0"),
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: true,
      },
      // 1 validator slashed
      {
        ethBalance: parseEther("26.6"),
        expectedRewards: parseEther("0"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // 1 validator fully withdrawn + 1 slashed
      {
        ethBalance: parseEther("58.6"), // 26.6 + 32
        expectedRewards: parseEther("0"),
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: true,
        fuseBlown: false,
      },
    ];

    for (const testCase of testCases) {
      const {
        ethBalance,
        expectedRewards,
        expectedValidatorsFullWithdrawals,
        slashDetected,
        fuseBlown,
      } = testCase;
      it(`Expect that ${formatUnits(
        ethBalance
      )} ETH will result in ${formatUnits(
        expectedRewards
      )} ETH rewards and ${expectedValidatorsFullWithdrawals} validators withdrawn.`, async () => {
        const { nativeStakingSSVStrategy, governor, strategist } = fixture;

        // setup state
        await setBalance(nativeStakingSSVStrategy.address, ethBalance);
        // pause, so manuallyFixAccounting can be called
        await nativeStakingSSVStrategy.connect(strategist).pause();
        await nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          30, // activeDepositedValidators
          parseEther("0", "ether"), //_ethToWeth
          parseEther("0", "ether"), //_wethToBeSentToVault
          parseEther("0", "ether"), //_beaconChainRewardWETH
          parseEther("3000", "ether"), //_ethThresholdCheck
          parseEther("3000", "ether") //_wethThresholdCheck
        );

        // check accounting values
        const tx = await nativeStakingSSVStrategy
          .connect(governor)
          .doAccounting();

        if (expectedRewards.gt(BigNumber.from("0"))) {
          await expect(tx)
            .to.emit(nativeStakingSSVStrategy, "AccountingBeaconChainRewards")
            .withArgs(expectedRewards);
        } else {
          await expect(tx).to.not.emit(
            nativeStakingSSVStrategy,
            "AccountingBeaconChainRewards"
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
          parseEther("2", "ether"), //_beaconChainRewardWETH
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
