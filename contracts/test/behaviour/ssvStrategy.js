const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");
const {
  setBalance,
  setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");

const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { getClusterInfo } = require("../../utils/ssv");

const {
  createFixtureLoader,
  nativeStakingSSVStrategyFixture,
} = require("./../_fixture");
const { parseEther } = require("ethers/lib/utils");

const loadFixture = createFixtureLoader(nativeStakingSSVStrategyFixture);

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * @example
    shouldBehaveLikeAnSsvStrategy(() => ({
        ...fixture,
    }));
 */

const shouldBehaveLikeAnSsvStrategy = (context) => {
  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { nativeStakingSSVStrategy, addresses } = await context();
      await expect(
        await nativeStakingSSVStrategy.WETH_TOKEN_ADDRESS()
      ).to.equal(addresses.WETH, "Incorrect WETH address set");
      await expect(await nativeStakingSSVStrategy.SSV_TOKEN_ADDRESS()).to.equal(
        addresses.SSV,
        "Incorrect SSV Token address"
      );
      await expect(
        await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS()
      ).to.equal(addresses.SSVNetwork, "Incorrect SSV Network address");
      await expect(
        await nativeStakingSSVStrategy.BEACON_CHAIN_DEPOSIT_CONTRACT()
      ).to.equal(
        addresses.beaconChainDepositContract,
        "Incorrect Beacon deposit contract"
      );
      await expect(await nativeStakingSSVStrategy.VAULT_ADDRESS()).to.equal(
        addresses.OETHVaultProxy,
        "Incorrect OETH Vault address"
      );
      await expect(await nativeStakingSSVStrategy.fuseIntervalStart()).to.equal(
        oethUnits("21.6"),
        "Incorrect fuse start"
      );
      await expect(await nativeStakingSSVStrategy.fuseIntervalEnd()).to.equal(
        oethUnits("25.6"),
        "Incorrect fuse end"
      );
      await expect(
        await nativeStakingSSVStrategy.validatorRegistrator()
      ).to.equal(
        addresses.validatorRegistrator,
        "Incorrect validator registrator"
      );
    });
  });

  describe("Deposit/Allocation", function () {
    it("Should accept and handle WETH allocation", async () => {
      const { oethVault, weth, domen, nativeStakingSSVStrategy } =
        await context();
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      const depositAmount = oethUnits("32");
      const wethBalanceBefore = await weth.balanceOf(
        nativeStakingSSVStrategy.address
      );
      const strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );

      // Transfer some WETH to strategy
      await weth
        .connect(domen)
        .transfer(nativeStakingSSVStrategy.address, depositAmount);

      // Call deposit by impersonating the Vault
      const tx = await nativeStakingSSVStrategy
        .connect(fakeVaultSigner)
        .deposit(weth.address, depositAmount);

      expect(tx)
        .to.emit(nativeStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, AddressZero, depositAmount);

      expect(await weth.balanceOf(nativeStakingSSVStrategy.address)).to.equal(
        wethBalanceBefore.add(depositAmount),
        "WETH not transferred"
      );
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        strategyBalanceBefore.add(depositAmount),
        "strategy checkBalance not increased"
      );
    });
  });

  describe("Validator operations", function () {
    beforeEach(async () => {
      const { weth, domen, nativeStakingSSVStrategy, addresses } =
        await context();

      // Add 32 WETH to the strategy so it can be staked
      await weth
        .connect(domen)
        .transfer(nativeStakingSSVStrategy.address, oethUnits("32"));
    });

    it("Should register and staked 32 ETH by validator registrator", async () => {
      const {
        weth,
        nativeStakingSSVStrategy,
        validatorRegistrator,
        testValidator,
      } = await context();

      const strategyWethBalanceBefore = await weth.balanceOf(
        nativeStakingSSVStrategy.address
      );

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorIds: testValidator.operatorIds,
        chainId: 1,
        ssvNetwork: addresses.SSVNetwork,
      });

      const stakeAmount = oethUnits("32");

      // Register a new validator with the SSV Network
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          stakeAmount,
          cluster
        );
      await expect(regTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorRegistered")
        .withArgs(testValidator.publicKey, testValidator.operatorIds);

      // Stake 32 ETH to the new validator
      const stakeTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth([
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
        ]);

      await expect(stakeTx)
        .to.emit(nativeStakingSSVStrategy, "ETHStaked")
        .withNamedArgs({
          pubkey: testValidator.publicKey,
          amount: stakeAmount,
        });

      expect(await weth.balanceOf(nativeStakingSSVStrategy.address)).to.equal(
        strategyWethBalanceBefore.sub(
          stakeAmount,
          "strategy WETH not decreased"
        )
      );
    });

    it.only("Should exit and remove validator by validator registrator", async () => {
      const {
        nativeStakingSSVStrategy,
        ssvNetwork,
        validatorRegistrator,
        addresses,
        testValidator,
      } = await context();

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorIds: testValidator.operatorIds,
        chainId: 1,
        ssvNetwork: addresses.SSVNetwork,
      });

      const stakeAmount = oethUnits("32");

      // Register a new validator with the SSV network
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          stakeAmount,
          cluster
        );
      const regReceipt = await regTx.wait();
      const ValidatorAddedEvent = ssvNetwork.interface.parseLog(
        regReceipt.events[2]
      );
      const { cluster: newCluster } = ValidatorAddedEvent.args;

      // Stake 32 ETH to the new validator
      await nativeStakingSSVStrategy.connect(validatorRegistrator).stakeEth([
        {
          pubkey: testValidator.publicKey,
          signature: testValidator.signature,
          depositDataRoot: testValidator.depositDataRoot,
        },
      ]);

      console.log("HEre!")
      // exit validator from SSV network
      const exitTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .exitSsvValidator(testValidator.publicKey, testValidator.operatorIds);

      console.log("HEre! 1")
      await expect(exitTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorExitInitiated")
        .withArgs(testValidator.publicKey, testValidator.operatorIds);

      console.log("HEre! 2")
      const removeTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          newCluster
        );

      await expect(removeTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorExitCompleted")
        .withArgs(testValidator.publicKey, testValidator.operatorIds);
    });
  });

  describe("Accounting for ETH", function () {
    let strategyBalanceBefore;
    let consensusRewardsBefore;
    let activeDepositedValidatorsBefore = 30000;
    beforeEach(async () => {
      const { nativeStakingSSVStrategy, validatorRegistrator, weth } =
        await context();

      // clear any ETH sitting in the strategy
      await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      // Set the number validators to a high number
      await setStorageAt(
        nativeStakingSSVStrategy.address,
        52, // the storage slot
        activeDepositedValidatorsBefore
      );

      strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );
      consensusRewardsBefore =
        await nativeStakingSSVStrategy.consensusRewards();
    });

    it("Should account for new consensus rewards", async () => {
      const { nativeStakingSSVStrategy, validatorRegistrator, weth } =
        await context();

      const rewards = oethUnits("2");

      // simulate consensus rewards
      await setBalance(
        nativeStakingSSVStrategy.address,
        consensusRewardsBefore.add(rewards)
      );

      const tx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingConsensusRewards")
        .withArgs(rewards);

      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(strategyBalanceBefore, "checkBalance should not increase");
      expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
        consensusRewardsBefore.add(rewards),
        "consensusRewards should increase"
      );
    });
    it("Should account for withdrawals and consensus rewards", async () => {
      const {
        oethVault,
        nativeStakingSSVStrategy,
        validatorRegistrator,
        weth,
      } = await context();

      const rewards = oethUnits("3");
      const withdrawals = oethUnits("64");
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      // simulate withdraw of 2 validators and consensus rewards
      await setBalance(
        nativeStakingSSVStrategy.address,
        withdrawals.add(rewards)
      );

      const tx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingFullyWithdrawnValidator")
        .withArgs(2, activeDepositedValidatorsBefore - 2, withdrawals);

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingConsensusRewards")
        .withArgs(rewards);

      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        strategyBalanceBefore.sub(withdrawals),
        "checkBalance should decrease"
      );
      expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
        consensusRewardsBefore.add(rewards),
        "consensusRewards should increase"
      );
      expect(
        await nativeStakingSSVStrategy.activeDepositedValidators()
      ).to.equal(
        activeDepositedValidatorsBefore - 2,
        "active validators decreases"
      );
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(withdrawals, "WETH in vault should increase")
      );
    });
  });

  describe("Harvest", async function () {
    it("Should account for new execution rewards", async () => {
      const {
        oethHarvester,
        josh,
        nativeStakingSSVStrategy,
        nativeStakingFeeAccumulator,
        oethDripper,
        weth,
        validatorRegistrator,
        addresses,
      } = await context();
      const dripperWethBefore = await weth.balanceOf(oethDripper.address);

      const strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );

      // add some ETH to the FeeAccumulator to simulate execution rewards
      const executionRewards = parseEther("7");
      await setBalance(nativeStakingFeeAccumulator.address, executionRewards);
      // simulate consensus rewards
      const consensusRewards = parseEther("5");
      await setBalance(nativeStakingSSVStrategy.address, consensusRewards);
      // account for the consensus rewards
      await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      // prettier-ignore
      const tx = await oethHarvester
        .connect(josh)["harvestAndSwap(address)"](nativeStakingSSVStrategy.address);

      await expect(tx)
        .to.emit(oethHarvester, "RewardProceedsTransferred")
        .withArgs(
          weth.address,
          AddressZero,
          executionRewards.add(consensusRewards),
          0
        );

      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(strategyBalanceBefore, "checkBalance should not increase");

      expect(await weth.balanceOf(oethDripper.address)).to.equal(
        dripperWethBefore.add(executionRewards).add(consensusRewards),
        "Dripper WETH balance should increase"
      );
    });
  });
};

module.exports = { shouldBehaveLikeAnSsvStrategy };
