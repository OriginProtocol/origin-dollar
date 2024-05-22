const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
const {
  setBalance,
  setStorageAt,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");

const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const minFixAccountingCadence = 7200 + 1;

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
    it("Should not allow ETH to be sent to the strategy if not FeeAccumulator or WETH", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      const signer = nativeStakingSSVStrategy.provider.getSigner(
        strategist.address
      );
      const tx = {
        to: nativeStakingSSVStrategy.address,
        value: parseEther("2"),
      };

      await expect(signer.sendTransaction(tx)).to.be.revertedWith(
        "eth not from allowed contracts"
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
  });

  describe("Accounting", function () {
    describe("Should account for beacon chain ETH", function () {
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
          slashDetected: false,
          fuseBlown: true,
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
        // fuse blown + 1 withdrawn validator with previous rewards
        {
          ethBalance: 55,
          previousConsensusRewards: 1,
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
        // 2 full withdraws on previous rewards
        {
          ethBalance: 66,
          previousConsensusRewards: 2,
          expectedConsensusRewards: 0,
          expectedValidatorsFullWithdrawals: 2,
          slashDetected: false,
          fuseBlown: false,
        },
        // consensus rewards on large previous rewards
        {
          ethBalance: 66,
          previousConsensusRewards: 65,
          expectedConsensusRewards: 1,
          expectedValidatorsFullWithdrawals: 0,
          slashDetected: false,
          fuseBlown: false,
        },
        // consensus rewards on large previous rewards with withdraw
        {
          ethBalance: 100,
          previousConsensusRewards: 65,
          expectedConsensusRewards: 3,
          expectedValidatorsFullWithdrawals: 1,
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

        it(`given ${testCase.ethBalance} ETH balance and ${
          testCase.previousConsensusRewards
        } previous consensus rewards, then ${
          testCase.expectedConsensusRewards
        } consensus rewards, ${expectedValidatorsFullWithdrawals} withdraws${
          fuseBlown ? ", fuse blown" : ""
        }${slashDetected ? ", slash detected" : ""}.`, async () => {
          const { nativeStakingSSVStrategy, governor } = fixture;

          // setup state
          if (ethBalance.gt(0)) {
            await setBalance(nativeStakingSSVStrategy.address, ethBalance);
          }

          await setActiveDepositedValidators(30, nativeStakingSSVStrategy);
          await setConsensusRewards(
            previousConsensusRewards,
            nativeStakingSSVStrategy
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
    });

    it("Only strategist is allowed to manually fix accounting", async () => {
      const { nativeStakingSSVStrategy, strategist, governor } = fixture;

      await nativeStakingSSVStrategy.connect(strategist).pause();
      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          1, //_validatorsDelta
          parseEther("2") //_consensusRewardsDelta
        )
      ).to.be.revertedWith("Caller is not the Strategist");
    });

    it("Accounting needs to be paused in order to call fix accounting function", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          1, //_validatorsDelta
          parseEther("2") //_consensusRewardsDelta
        )
      ).to.be.revertedWith("Pausable: not paused");
    });

    it("Validators delta should not be <-4 or >4 for fix accounting function", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await mine(minFixAccountingCadence);

      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          -4, //_validatorsDelta
          0 //_consensusRewardsDelta
        )
      ).to.be.revertedWith("invalid validatorsDelta");

      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          4, //_validatorsDelta
          0 //_consensusRewardsDelta
        )
      ).to.be.revertedWith("invalid validatorsDelta");
    });

    it("Consensus rewards delta should not be <-333> and >333 for fix accounting function", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await mine(minFixAccountingCadence);

      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          0, //_validatorsDelta
          parseEther("-333") //_consensusRewardsDelta
        )
      ).to.be.revertedWith("invalid consensusRewardsDelta");

      await expect(
        nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          0, //_validatorsDelta
          parseEther("333") //_consensusRewardsDelta
        )
      ).to.be.revertedWith("invalid consensusRewardsDelta");
    });

    describe("Should allow strategist to recover paused contract", async () => {
      for (const validatorsDelta of [-3, -2, -1, 0, 1, 2, 3]) {
        it(`by changing validators by ${validatorsDelta}`, async () => {
          const { nativeStakingSSVStrategy, strategist } = fixture;

          await setActiveDepositedValidators(10, nativeStakingSSVStrategy);

          await nativeStakingSSVStrategy.connect(strategist).pause();
          await mine(minFixAccountingCadence);
          const activeDepositedValidatorsBefore =
            await nativeStakingSSVStrategy.activeDepositedValidators();

          const tx = await nativeStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(validatorsDelta, 0);

          expect(tx)
            .to.emit(nativeStakingSSVStrategy, "AccountingManuallyFixed")
            .withArgs(validatorsDelta, 0, 0);

          expect(
            await nativeStakingSSVStrategy.activeDepositedValidators()
          ).to.equal(
            activeDepositedValidatorsBefore.add(validatorsDelta),
            "active deposited validators not updated"
          );
        });
      }

      for (const delta of [-332, -320, -1, 0, 1, 320, 332]) {
        it(`by changing consensus rewards by ${delta}`, async () => {
          const { nativeStakingSSVStrategy, strategist } = fixture;

          await setBalance(nativeStakingSSVStrategy.address, parseEther("670"));
          await setConsensusRewards(
            parseEther("336"),
            nativeStakingSSVStrategy
          );
          await setActiveDepositedValidators(10000, nativeStakingSSVStrategy);

          await nativeStakingSSVStrategy.connect(strategist).pause();
          await mine(minFixAccountingCadence);
          const consensusRewardsDelta = parseEther(delta.toString());

          const tx = await nativeStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(0, consensusRewardsDelta);

          expect(tx)
            .to.emit(nativeStakingSSVStrategy, "AccountingManuallyFixed")
            .withArgs(0, consensusRewardsDelta, 0);

          expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
            await nativeStakingSSVStrategy.provider.getBalance(
              nativeStakingSSVStrategy.address
            ),
            "consensus rewards matches eth balance"
          );
        });
      }

      it("by changing all three manuallyFixAccounting delta values", async () => {
        const { nativeStakingSSVStrategy, strategist, josh, weth } = fixture;

        await setBalance(nativeStakingSSVStrategy.address, parseEther("5"));
        await weth
          .connect(josh)
          .transfer(nativeStakingSSVStrategy.address, parseEther("5"));

        await nativeStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        // unit test fixture sets OUSD governor as accounting governor
        const tx = await nativeStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            1, //_validatorsDelta
            parseEther("2.3") //_consensusRewardsDeltaDelta
          );

        expect(tx)
          .to.emit(nativeStakingSSVStrategy, "AccountingManuallyFixed")
          .withArgs(
            1, // validatorsDelta
            parseEther("2.3") // consensusRewards
          );
      });

      it("Calling manually fix accounting too often should result in an error", async () => {
        const { nativeStakingSSVStrategy, strategist } = fixture;

        await nativeStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await nativeStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            parseEther("0") //_consensusRewardsDelta
          );

        await nativeStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence - 4);
        await expect(
          nativeStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
            0, //_validatorsDelta
            parseEther("0") //_consensusRewardsDelta
          )
        ).to.be.revertedWith("manuallyFixAccounting called too soon");
      });

      it("Calling manually fix accounting twice with enough blocks in between should pass", async () => {
        const { nativeStakingSSVStrategy, strategist } = fixture;

        await nativeStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await nativeStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            parseEther("0") //_consensusRewardsDelta
          );

        await nativeStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await nativeStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            parseEther("0") //_consensusRewardsDelta
          );
      });
    });
  });

  describe("Harvest and strategy balance", function () {
    // fuseStart 21.6
    // fuseEnd 25.6
    // expectedHarvester = feeAccumulatorEth + consensusRewards
    // expectedBalance = deposits + nrOfActiveDepositedValidators * 32
    const rewardTestCases = [
      // no rewards to harvest
      {
        feeAccumulatorEth: 0,
        consensusRewards: 0,
        deposits: 0,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 0,
        expectedBalance: 0,
      },
      // a little execution rewards
      {
        feeAccumulatorEth: 0.1,
        consensusRewards: 0,
        deposits: 0,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 0.1,
        expectedBalance: 0,
      },
      // a little consensus rewards
      {
        feeAccumulatorEth: 0,
        consensusRewards: 0.2,
        deposits: 0,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 0.2,
        expectedBalance: 0,
      },
      // a little consensus and execution rewards
      {
        feeAccumulatorEth: 0.1,
        consensusRewards: 0.2,
        deposits: 0,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 0.3,
        expectedBalance: 0,
      },
      // a lot of consensus rewards
      {
        feeAccumulatorEth: 2.2,
        consensusRewards: 16.3,
        deposits: 100,
        nrOfActiveDepositedValidators: 7,
        expectedHarvester: 18.5,
        expectedBalance: 100 + 7 * 32,
      },
      // consensus rewards just below fuse start
      {
        feeAccumulatorEth: 10.2,
        consensusRewards: 21.5,
        deposits: 0,
        nrOfActiveDepositedValidators: 5,
        expectedHarvester: 31.7,
        expectedBalance: 0 + 5 * 32,
      },
      // consensus rewards just below fuse start
      {
        feeAccumulatorEth: 10.2,
        consensusRewards: 21.5,
        deposits: 1,
        nrOfActiveDepositedValidators: 0,
        expectedHarvester: 31.7,
        expectedBalance: 1 + 0 * 32,
      },
    ];

    for (const testCase of rewardTestCases) {
      const feeAccumulatorEth = parseEther(
        testCase.feeAccumulatorEth.toString()
      );
      const consensusRewards = parseEther(testCase.consensusRewards.toString());
      const deposits = parseEther(testCase.deposits.toString());
      const expectedHarvester = parseEther(
        testCase.expectedHarvester.toString()
      );
      const expectedBalance = parseEther(testCase.expectedBalance.toString());
      const { nrOfActiveDepositedValidators } = testCase;

      describe(`given ${testCase.feeAccumulatorEth} execution rewards, ${testCase.consensusRewards} consensus rewards, ${testCase.deposits} deposits and ${nrOfActiveDepositedValidators} validators`, () => {
        beforeEach(async () => {
          const { nativeStakingSSVStrategy, governor, weth, josh } = fixture;
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
          await setActiveDepositedValidators(
            nrOfActiveDepositedValidators,
            nativeStakingSSVStrategy
          );
          await setConsensusRewards(consensusRewards, nativeStakingSSVStrategy);

          // run the accounting
          await nativeStakingSSVStrategy.connect(governor).doAccounting();
        });

        it(`then should harvest ${testCase.expectedHarvester} WETH`, async () => {
          const { nativeStakingSSVStrategy, oethHarvester, weth } = fixture;
          const sHarvester = await impersonateAndFund(oethHarvester.address);

          const harvesterWethBalanceBefore = await weth.balanceOf(
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
          ).sub(harvesterWethBalanceBefore);
          expect(harvesterBalanceDiff).to.equal(expectedHarvester);
        });

        it(`then the strategy should have a ${testCase.expectedBalance} balance`, async () => {
          const { nativeStakingSSVStrategy, weth } = fixture;

          expect(
            await nativeStakingSSVStrategy.checkBalance(weth.address)
          ).to.equal(expectedBalance);
        });
      });
    }
  });

  it.skip("Deposit alternate deposit_data_root ", async () => {
    const { depositContractUtils } = fixture;

    const newDepositDataRoot =
      await depositContractUtils.calculateDepositDataRoot(
        "0x9254b0fba5173550bcf0950031533e816150167577c15636922406977bafa09ed1a1cc72a148030db977d7091d31c1fa",
        "0x010000000000000000000000cf4a9e80ddb173cc17128a361b98b9a140e3932e",
        "0x9144bddd6d969571dd058d9656c9da32cf4b8556e18a16362383d02a93bd0901f100874f7f795165a2162badceb5466811f5cfbce8be21d02a87af1898cbe53f5d160d46cbc0863d8e6e28d5f0becf4804cf728b39d0bae69540df896ce97b8b"
      );
    console.log(`the new newDepositDataRoot is: ${newDepositDataRoot}`);
  });
});

const setActiveDepositedValidators = async (
  validators,
  nativeStakingSSVStrategy
) => {
  await setStorageAt(nativeStakingSSVStrategy.address, 52, validators);

  expect(await nativeStakingSSVStrategy.activeDepositedValidators()).to.equal(
    validators,
    "validators no set properly"
  );
};

const setConsensusRewards = async (
  consensusRewards,
  nativeStakingSSVStrategy
) => {
  await setStorageAt(nativeStakingSSVStrategy.address, 104, consensusRewards);

  expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
    consensusRewards,
    "consensusRewards no set properly"
  );
};
