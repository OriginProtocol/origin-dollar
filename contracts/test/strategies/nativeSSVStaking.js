const { expect } = require("chai");
const ethers = require("ethers");
const { utils, BigNumber } = ethers;
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

describe("ForkTest: Native SSV Staking Strategy", function () {
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
    it("Should not allow sending of ETH to the strategy via a transaction", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      const signer = nativeStakingSSVStrategy.provider.getSigner(
        strategist.address
      );
      const tx = {
        to: nativeStakingSSVStrategy.address,
        value: ethers.utils.parseEther("2", "ether"),
      };

      await expect(signer.sendTransaction(tx)).to.be.revertedWith(
        "function selector was not recognized and there's no fallback nor receive function"
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
        .setRegistratorAddress(strategist.address);

      const events = (await tx.wait()).events || [];
      const RegistratorAddressChangedEvent = events.find(
        (e) => e.event === "RegistratorAddressChanged"
      );

      expect(RegistratorAddressChangedEvent).to.not.be.undefined;
      expect(RegistratorAddressChangedEvent.event).to.equal(
        "RegistratorAddressChanged"
      );
      expect(RegistratorAddressChangedEvent.args[0]).to.equal(governor.address);
      expect(RegistratorAddressChangedEvent.args[1]).to.equal(
        strategist.address
      );
    });

    it("Non governor should not be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setRegistratorAddress(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Non governor should not be able to update the fuse intervals", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setFuseInterval(utils.parseEther("21.6"), utils.parseEther("25.6"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Fuse interval start needs to be larger than fuse end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(utils.parseEther("25.6"), utils.parseEther("21.6"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("There should be at least 4 ETH between interval start and interval end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(utils.parseEther("21.6"), utils.parseEther("25.5"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("Revert when fuse intervals are larger than 32 ether", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(utils.parseEther("32.1"), utils.parseEther("32.1"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("Governor should be able to change fuse interval", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      const oldFuseStartBn = utils.parseEther("21.6");
      const oldFuseEndBn = utils.parseEther("25.6");
      const fuseStartBn = utils.parseEther("22.6");
      const fuseEndBn = utils.parseEther("26.6");

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(fuseStartBn, fuseEndBn);

      const events = (await tx.wait()).events || [];
      const FuseIntervalUpdated = events.find(
        (e) => e.event === "FuseIntervalUpdated"
      );

      expect(FuseIntervalUpdated).to.not.be.undefined;
      expect(FuseIntervalUpdated.event).to.equal("FuseIntervalUpdated");
      expect(FuseIntervalUpdated.args[0]).to.equal(oldFuseStartBn); // prev fuse start
      expect(FuseIntervalUpdated.args[1]).to.equal(oldFuseEndBn); // prev fuse end
      expect(FuseIntervalUpdated.args[2]).to.equal(fuseStartBn); // fuse start
      expect(FuseIntervalUpdated.args[3]).to.equal(fuseEndBn); // fuse end
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

    it("Only governor can change the strategist", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      await expect(
        nativeStakingSSVStrategy
          .connect(strategist)
          .setStrategist(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Change the accounting governor", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setAccountingGovernor(strategist.address);

      const events = (await tx.wait()).events || [];
      const AccountingGovernorChangedEvent = events.find(
        (e) => e.event === "AccountingGovernorAddressChanged"
      );

      expect(AccountingGovernorChangedEvent).to.not.be.undefined;
      expect(AccountingGovernorChangedEvent.event).to.equal(
        "AccountingGovernorAddressChanged"
      );
      expect(AccountingGovernorChangedEvent.args[0]).to.equal(governor.address);
      expect(AccountingGovernorChangedEvent.args[1]).to.equal(
        strategist.address
      );
    });

    it("Change the strategist", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setStrategist(governor.address);

      const events = (await tx.wait()).events || [];
      const strategistAddressChanged = events.find(
        (e) => e.event === "StrategistAddressChanged"
      );

      expect(strategistAddressChanged).to.not.be.undefined;
      expect(strategistAddressChanged.event).to.equal(
        "StrategistAddressChanged"
      );
      expect(strategistAddressChanged.args[0]).to.equal(strategist.address);
      expect(strategistAddressChanged.args[1]).to.equal(governor.address);
    });
  });

  describe("Accounting", function () {
    const testCases = [
      // normal beacon chain rewards
      {
        ethBalance: utils.parseEther("14"),
        expectedRewards: utils.parseEther("14"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: false,
      },
      // normal beacon chain rewards + 1 withdrawn validator
      {
        ethBalance: utils.parseEther("34"),
        expectedRewards: utils.parseEther("2"),
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: false,
      },
      // 8 withdrawn validators + beacon chain rewards
      {
        ethBalance: utils.parseEther("276"),
        expectedRewards: utils.parseEther("20"),
        expectedValidatorsFullWithdrawals: 8,
        slashDetected: false,
        fuseBlown: false,
      },
      // fuse blown
      {
        ethBalance: utils.parseEther("22"),
        expectedRewards: utils.parseEther("0"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: false,
        fuseBlown: true,
      },
      // fuse blown + 1 full withdrawal
      {
        ethBalance: utils.parseEther("54"),
        expectedRewards: utils.parseEther("0"),
        expectedValidatorsFullWithdrawals: 1,
        slashDetected: false,
        fuseBlown: true,
      },
      // 1 validator slashed
      {
        ethBalance: utils.parseEther("26.6"),
        expectedRewards: utils.parseEther("0"),
        expectedValidatorsFullWithdrawals: 0,
        slashDetected: true,
        fuseBlown: false,
      },
      // 1 validator fully withdrawn + 1 slashed
      {
        ethBalance: utils.parseEther("58.6"), // 26.6 + 32
        expectedRewards: utils.parseEther("0"),
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
      it(`Expect that ${utils.formatUnits(
        ethBalance
      )} ETH will result in ${utils.formatUnits(
        expectedRewards
      )} ETH rewards and ${expectedValidatorsFullWithdrawals} validators withdrawn.`, async () => {
        const { nativeStakingSSVStrategy, governor, strategist } = fixture;

        // setup state
        await setBalance(nativeStakingSSVStrategy.address, ethBalance);
        // pause, so manuallyFixAccounting can be called
        await nativeStakingSSVStrategy.connect(strategist).pause();
        await nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          30, // activeDepositedValidators
          ethers.utils.parseEther("0", "ether"), //_ethToWeth
          ethers.utils.parseEther("0", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("0", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("3000", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("3000", "ether") //_wethThresholdCheck
        );

        // check accounting values
        const tx = await nativeStakingSSVStrategy
          .connect(governor)
          .doAccounting();

        const events = (await tx.wait()).events || [];

        const BeaconRewardsEvent = events.find(
          (e) => e.event === "AccountingBeaconChainRewards"
        );
        if (expectedRewards.gt(BigNumber.from("0"))) {
          expect(BeaconRewardsEvent).to.not.be.undefined;
          expect(BeaconRewardsEvent.args[0]).to.equal(expectedRewards);
        } else {
          expect(BeaconRewardsEvent).to.be.undefined;
        }

        const WithdrawnEvent = events.find(
          (e) => e.event === "AccuntingFullyWithdrawnValidator"
        );
        if (expectedValidatorsFullWithdrawals > 0) {
          expect(WithdrawnEvent).to.not.be.undefined;
          expect(WithdrawnEvent.args[0]).to.equal(
            BigNumber.from(`${expectedValidatorsFullWithdrawals}`)
          );
          // still active validators
          expect(WithdrawnEvent.args[1]).to.equal(
            BigNumber.from(`${30 - expectedValidatorsFullWithdrawals}`)
          );
          // weth sent to vault
          expect(WithdrawnEvent.args[2]).to.equal(
            utils
              .parseEther("32")
              .mul(BigNumber.from(`${expectedValidatorsFullWithdrawals}`))
          );
        } else {
          expect(WithdrawnEvent).to.be.undefined;
        }

        const PausedEvent = events.find((e) => e.event === "Paused");
        if (fuseBlown) {
          expect(PausedEvent).to.not.be.undefined;
        } else {
          expect(PausedEvent).to.be.undefined;
        }

        const SlashEvent = events.find(
          (e) => e.event === "AccuntingValidatorSlashed"
        );
        if (slashDetected) {
          expect(SlashEvent).to.not.be.undefined;
          expect(SlashEvent.args[0]).to.equal(
            BigNumber.from(`${30 - expectedValidatorsFullWithdrawals - 1}`)
          );
        } else {
          expect(SlashEvent).to.be.undefined;
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
          ethers.utils.parseEther("2", "ether"), //_ethToWeth
          ethers.utils.parseEther("2", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("2", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("0", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("0", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("Caller is not the Accounting Governor");
    });

    it("Accounting needs to be paused in order to call fix accounting function", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          ethers.utils.parseEther("2", "ether"), //_ethToWeth
          ethers.utils.parseEther("2", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("2", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("1", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("0", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("NotPaused");
    });

    it("Should not execute manual recovery if eth threshold reached", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        ethers.utils.parseEther("6", "ether")
      );
      await weth
        .connect(josh)
        .transfer(
          nativeStakingSSVStrategy.address,
          ethers.utils.parseEther("5", "ether")
        );

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          ethers.utils.parseEther("2", "ether"), //_ethToWeth
          ethers.utils.parseEther("2", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("2", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("5", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("5", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("ManualFixAccountingThresholdReached");
    });

    it("Should not execute manual recovery if weth threshold reached", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        ethers.utils.parseEther("5", "ether")
      );
      await weth
        .connect(josh)
        .transfer(
          nativeStakingSSVStrategy.address,
          ethers.utils.parseEther("6", "ether")
        );

      await nativeStakingSSVStrategy.connect(strategist).pause();
      await expect(
        nativeStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          10, //_activeDepositedValidators
          ethers.utils.parseEther("2", "ether"), //_ethToWeth
          ethers.utils.parseEther("2", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("2", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("5", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("5", "ether") //_wethThresholdCheck
        )
      ).to.be.revertedWith("ManualFixAccountingThresholdReached");
    });

    it("Should allow 5/8 governor to recover paused contract and correct the accounting state", async () => {
      const { nativeStakingSSVStrategy, strategist, governor, josh, weth } =
        fixture;

      await setBalance(
        nativeStakingSSVStrategy.address,
        ethers.utils.parseEther("5", "ether")
      );
      await weth
        .connect(josh)
        .transfer(
          nativeStakingSSVStrategy.address,
          ethers.utils.parseEther("5", "ether")
        );

      await nativeStakingSSVStrategy.connect(strategist).pause();
      // unit test fixture sets OUSD governor as accounting governor
      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .manuallyFixAccounting(
          3, //_activeDepositedValidators
          ethers.utils.parseEther("2.1", "ether"), //_ethToWeth
          ethers.utils.parseEther("2.2", "ether"), //_wethToBeSentToVault
          ethers.utils.parseEther("2.3", "ether"), //_beaconChainRewardWETH
          ethers.utils.parseEther("5", "ether"), //_ethThresholdCheck
          ethers.utils.parseEther("5", "ether") //_wethThresholdCheck
        );

      const events = (await tx.wait()).events || [];
      const AccountingManuallyFixedEvent = events.find(
        (e) => e.event === "AccountingManuallyFixed"
      );

      expect(AccountingManuallyFixedEvent).to.not.be.undefined;
      expect(AccountingManuallyFixedEvent.event).to.equal(
        "AccountingManuallyFixed"
      );
      expect(AccountingManuallyFixedEvent.args[0]).to.equal(0); // oldActiveDepositedValidators
      expect(AccountingManuallyFixedEvent.args[1]).to.equal(3); // activeDepositedValidators
      expect(AccountingManuallyFixedEvent.args[2]).to.equal(
        ethers.utils.parseEther("0", "ether")
      ); // oldBeaconChainRewardWETH
      expect(AccountingManuallyFixedEvent.args[3]).to.equal(
        ethers.utils.parseEther("2.3", "ether")
      ); // beaconChainRewardWETH
      expect(AccountingManuallyFixedEvent.args[4]).to.equal(
        ethers.utils.parseEther("2.1", "ether")
      ); // ethToWeth
      expect(AccountingManuallyFixedEvent.args[5]).to.equal(
        ethers.utils.parseEther("2.2", "ether")
      ); // wethToBeSentToVault
    });
  });

  describe("General functionality", function () {
    const rewardTestCases = [
      {
        feeAccumulatorEth: utils.parseEther("2.2"),
        beaconChainRewardEth: utils.parseEther("16.3"),
        wethFromDeposits: utils.parseEther("100"),
        expectedEthSentToHarvester: utils.parseEther("18.5"),
      },
      {
        feeAccumulatorEth: utils.parseEther("10.2"),
        beaconChainRewardEth: utils.parseEther("21.6"),
        wethFromDeposits: utils.parseEther("0"),
        expectedEthSentToHarvester: utils.parseEther("31.8"),
      },
      {
        feeAccumulatorEth: utils.parseEther("0"),
        beaconChainRewardEth: utils.parseEther("0"),
        wethFromDeposits: utils.parseEther("0"),
        expectedEthSentToHarvester: utils.parseEther("0"),
      },
    ];

    for (const testCase of rewardTestCases) {
      it("Collecting rewards should correctly account for WETH", async () => {
        const {
          nativeStakingSSVStrategy,
          governor,
          strategist,
          oethHarvester,
          weth,
          josh,
        } = fixture;
        const {
          feeAccumulatorEth,
          beaconChainRewardEth,
          wethFromDeposits,
          expectedEthSentToHarvester,
        } = testCase;
        const feeAccumulatorAddress =
          await nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS();
        const sHarvester = await impersonateAndFund(oethHarvester.address);

        // setup state
        if (beaconChainRewardEth.gt(BigNumber.from("0"))) {
          // set the reward eth on the strategy
          await setBalance(
            nativeStakingSSVStrategy.address,
            beaconChainRewardEth
          );
        }
        if (feeAccumulatorEth.gt(BigNumber.from("0"))) {
          // set execution layer rewards on the fee accumulator
          await setBalance(feeAccumulatorAddress, feeAccumulatorEth);
        }
        if (wethFromDeposits.gt(BigNumber.from("0"))) {
          // send eth to the strategy as if Vault would send it via a Deposit function
          await weth
            .connect(josh)
            .transfer(nativeStakingSSVStrategy.address, wethFromDeposits);
        }

        // run the accounting
        await nativeStakingSSVStrategy.connect(governor).doAccounting();

        const harvesterWethBalance = await weth.balanceOf(
          oethHarvester.address
        );
        const tx = await nativeStakingSSVStrategy
          .connect(sHarvester)
          .collectRewardTokens();
        const events = (await tx.wait()).events || [];

        const harvesterBalanceDiff = (
          await weth.balanceOf(oethHarvester.address)
        ).sub(harvesterWethBalance);
        expect(harvesterBalanceDiff).to.equal(expectedEthSentToHarvester);

        const rewardTokenCollectedEvent = events.find(
          (e) => e.event === "RewardTokenCollected"
        );

        if (expectedEthSentToHarvester.gt(BigNumber.from("0"))) {
          expect(rewardTokenCollectedEvent).to.not.be.undefined;
          expect(rewardTokenCollectedEvent.event).to.equal(
            "RewardTokenCollected"
          );
          expect(rewardTokenCollectedEvent.args[1]).to.equal(weth.address);
          expect(rewardTokenCollectedEvent.args[2]).to.equal(
            expectedEthSentToHarvester
          );
        } else {
          expect(rewardTokenCollectedEvent).to.be.undefined;
        }
      });
    }

    it("Should be able to collect the SSV reward token", async () => {});

    it("Check balance should report correct values", async () => {});
  });
});
