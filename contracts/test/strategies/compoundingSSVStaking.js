const { expect } = require("chai");
const { network } = require("hardhat");
const { BigNumber } = require("ethers");
const { parseEther, parseUnits } = require("ethers").utils;
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const { ethUnits } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { zero } = require("../../utils/addresses");
const { calcDepositRoot } = require("../../tasks/beacon");
const { hashPubKey } = require("../../utils/beacon");
const { randomBytes } = require("crypto");
const {
  testValidators,
  testBalancesProofs,
} = require("./compoundingSSVStaking-validatorsData.json");

const {
  createFixtureLoader,
  compoundingStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(compoundingStakingSSVStrategyFixture);

const emptyCluster = [
  0, // validatorCount
  0, // networkFeeIndex
  0, // index
  true, // active
  0, // balance
];

const ETHInGwei = BigNumber.from("1000000000"); // 1 ETH in Gwei
const GweiInWei = BigNumber.from("1000000000"); // 1 Gwei in Wei

describe("Unit test: Compounding SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);
  let sGov;
  let sVault;
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
    const { compoundingStakingSSVStrategy, josh, weth } = fixture;
    sGov = await impersonateAndFund(
      await compoundingStakingSSVStrategy.governor()
    );
    sVault = await impersonateAndFund(
      await compoundingStakingSSVStrategy.vaultAddress()
    );
    await weth
      .connect(josh)
      .approve(compoundingStakingSSVStrategy.address, MAX_UINT256);
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.compoundingStakingSSVStrategy,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.compoundingStakingSSVStrategy,
    assets: [fixture.weth],
    valueAssets: [],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  describe("Initial setup", () => {
    it("Should anyone to send ETH", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      const signer = compoundingStakingSSVStrategy.provider.getSigner(
        strategist.address
      );
      const tx = {
        to: compoundingStakingSSVStrategy.address,
        value: parseEther("2"),
      };

      await expect(signer.sendTransaction(tx)).to.not.be.reverted;
    });

    it("SSV network should have allowance to spend SSV tokens of the strategy", async () => {
      const { compoundingStakingSSVStrategy, ssv } = fixture;

      const ssvNetworkAddress =
        await compoundingStakingSSVStrategy.SSV_NETWORK();
      await expect(
        await ssv.allowance(
          compoundingStakingSSVStrategy.address,
          ssvNetworkAddress
        )
      ).to.equal(MAX_UINT256);
    });
  });

  describe("Configuring the strategy", () => {
    it("Governor should be able to change the registrator address", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      const tx = await compoundingStakingSSVStrategy
        .connect(sGov)
        .setRegistrator(strategist.address);

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "RegistratorChanged")
        .withArgs(strategist.address);
    });

    it("Non governor should not be able to change the registrator address", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(strategist)
          .setRegistrator(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should add source strategy", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      const tx = await compoundingStakingSSVStrategy
        .connect(sGov)
        .addSourceStrategy(strategist.address);
      // Using a placeholder address for the source strategy

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "SourceStrategyAdded")
        .withArgs(strategist.address);
    });

    it("Non governor should not be able to add source strategy", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(strategist)
          .addSourceStrategy(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should support WETH as the only asset", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      const assets = await compoundingStakingSSVStrategy.supportsAsset(
        weth.address
      );
      expect(assets).to.equal(true);
    });
  });

  const processValidator = async (
    testValidator,
    state = "VERIFIED_DEPOSIT"
  ) => {
    const {
      beaconRoots,
      beaconOracle,
      compoundingStakingSSVStrategy,
      validatorRegistrator,
    } = fixture;

    const depositAmount = 1;

    // Register a new validator with the SSV Network
    const regTx = await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .registerSsvValidator(
        testValidator.publicKey,
        testValidator.operatorIds,
        testValidator.sharesData,
        0, // SSV amount
        emptyCluster
      );

    if (state === "REGISTERED") return regTx;

    // Stake ETH to the new validator

    await depositToStrategy(depositAmount);

    const depositDataRoot = await calcDepositRoot(
      compoundingStakingSSVStrategy.address,
      "0x02",
      testValidator.publicKey,
      testValidator.signature,
      depositAmount
    );

    const depositGwei = BigNumber.from(depositAmount).mul(ETHInGwei); // Convert ETH to Gwei

    const stakeTx = await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .stakeEth(
        {
          pubkey: testValidator.publicKey,
          signature: testValidator.signature,
          depositDataRoot,
        },
        depositGwei
      );

    if (state === "STAKED") return stakeTx;

    // Verify the validator

    // Set BeaconRoot for timestamp
    await beaconRoots["setBeaconRoot(uint256,bytes32)"](
      testValidator.validatorProof.nextBlockTimestamp,
      testValidator.validatorProof.root
    );

    // Verify the validator
    const verifiedValidatorTx =
      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        testValidator.validatorProof.bytes
      );

    if (state === "VERIFIED_VALIDATOR") return verifiedValidatorTx;

    // Mock the deposit on the execution layer
    await beaconOracle.mapSlot(
      testValidator.depositProof.depositBlockNumber,
      testValidator.depositProof.depositSlot,
      testValidator.depositProof.depositRoot
    );

    // Mock the processing on the beacon chain
    await beaconOracle.mapSlot(
      testValidator.depositProof.processedBlockNumber,
      testValidator.depositProof.processedSlot,
      testValidator.depositProof.processedRoot
    );

    const verifiedDepositTx = await compoundingStakingSSVStrategy.verifyDeposit(
      depositDataRoot,
      testValidator.depositProof.depositBlockNumber,
      testValidator.depositProof.processedSlot,
      testValidator.depositProof.firstPendingDepositSlot,
      testValidator.depositProof.proof
    );

    if (state === "VERIFIED_DEPOSIT") return verifiedDepositTx;

    throw Error(`Invalid state: ${state}`);
  };

  const topupValidator = async (
    testValidator,
    depositAmount,
    state = "VERIFIED_DEPOSIT"
  ) => {
    const {
      beaconOracle,
      compoundingStakingSSVStrategy,
      validatorRegistrator,
    } = fixture;

    // Stake ETH to the new validator

    await depositToStrategy(depositAmount);

    const depositDataRoot = await calcDepositRoot(
      compoundingStakingSSVStrategy.address,
      "0x02",
      testValidator.publicKey,
      testValidator.signature,
      depositAmount
    );

    const depositGwei = parseUnits(depositAmount.toString(), 9);

    const stakeTx = await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .stakeEth(
        {
          pubkey: testValidator.publicKey,
          signature: testValidator.signature,
          depositDataRoot,
        },
        depositGwei
      );

    if (state === "STAKED") return stakeTx;

    // Mock the deposit on the execution layer
    await beaconOracle.mapSlot(
      testValidator.depositProof.depositBlockNumber,
      testValidator.depositProof.depositSlot,
      testValidator.depositProof.depositRoot
    );

    // Mock the processing on the beacon chain
    await beaconOracle.mapSlot(
      testValidator.depositProof.processedBlockNumber,
      testValidator.depositProof.processedSlot,
      testValidator.depositProof.processedRoot
    );

    const verifiedDepositTx = await compoundingStakingSSVStrategy.verifyDeposit(
      depositDataRoot,
      testValidator.depositProof.depositBlockNumber,
      testValidator.depositProof.processedSlot,
      testValidator.depositProof.firstPendingDepositSlot,
      testValidator.depositProof.proof
    );

    if (state === "VERIFIED_DEPOSIT") return verifiedDepositTx;

    throw Error(`Invalid state: ${state}`);
  };

  const snapBalances = async (beaconBlockRoot) => {
    const { compoundingStakingSSVStrategy, beaconRoots } = fixture;

    if (!beaconBlockRoot) {
      beaconBlockRoot = "0x" + randomBytes(32).toString("hex");
    }

    // Disable auto-mining dynamically
    await network.provider.send("evm_setAutomine", [false]);

    await beaconRoots["setBeaconRoot(bytes32)"](beaconBlockRoot);

    await compoundingStakingSSVStrategy.snapBalances();

    // Mine both txs
    await ethers.provider.send("evm_mine", []);
    // Enable auto-mining
    await network.provider.send("evm_setAutomine", [true]);

    const lastBlock = await ethers.provider.getBlock("latest");

    return { beaconBlockRoot, timestamp: lastBlock.timestamp };
  };

  const assertBalances = async ({
    firstPendingDepositBlockNumber,
    wethAmount,
    ethAmount,
    balancesProof,
    pendingDepositAmount,
    activeValidators,
  }) => {
    const {
      beaconOracle,
      compoundingStakingSSVStrategy,
      weth,
      validatorRegistrator,
    } = fixture;

    // If the block number of the first pending deposit is not overridden
    if (!firstPendingDepositBlockNumber) {
      firstPendingDepositBlockNumber = balancesProof.firstPendingDeposit.block;
    }

    if (wethAmount > 0) {
      // Set some WETH in the strategy
      await setERC20TokenBalance(
        compoundingStakingSSVStrategy.address,
        weth,
        parseEther(wethAmount.toString())
      );
    }

    if (ethAmount > 0) {
      // Set some execution rewards
      await setBalance(
        compoundingStakingSSVStrategy.address,
        parseEther(ethAmount.toString())
      );
    }

    await snapBalances(balancesProof.blockRoot);

    await beaconOracle.mapSlot(
      firstPendingDepositBlockNumber,
      balancesProof.firstPendingDeposit.slot,
      balancesProof.firstPendingDeposit.blockRoot
    );

    const filteredLeaves = balancesProof.validatorBalanceLeaves.filter(
      (_, index) => activeValidators.includes(index)
    );
    const filteredProofs = balancesProof.validatorBalanceProofs.filter(
      (_, index) => activeValidators.includes(index)
    );
    const filteredBalances = balancesProof.validatorBalances.filter(
      (_, index) => activeValidators.includes(index)
    );

    // Verify balances with pending deposits and active validators
    const tx = await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .verifyBalances({
        ...balancesProof,
        validatorBalanceLeaves: filteredLeaves,
        validatorBalanceProofs: filteredProofs,
      });

    const totalDepositsWei = parseEther(pendingDepositAmount.toString());
    const wethBalance = parseEther(wethAmount.toString());
    const totalValidatorBalance = filteredBalances
      .map((balance) => parseEther(balance.toString()))
      .reduce((sum, balance) => sum.add(balance), parseEther("0"));
    const ethBalance = parseEther(ethAmount.toString());
    const totalBalance = totalDepositsWei
      .add(wethBalance)
      .add(totalValidatorBalance)
      .add(ethBalance);

    await expect(tx)
      .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
      .withNamedArgs({
        totalDepositsWei,
        totalValidatorBalance,
        wethBalance,
        ethBalance,
      });

    const verifiedEthBalance =
      await compoundingStakingSSVStrategy.lastVerifiedEthBalance();

    expect(verifiedEthBalance).to.equal(
      totalDepositsWei.add(totalValidatorBalance).add(ethBalance)
    );

    const stratBalance = await compoundingStakingSSVStrategy.checkBalance(
      weth.address
    );

    return {
      totalDepositsWei,
      wethBalance,
      totalValidatorBalance,
      ethBalance,
      totalBalance,
      verifiedEthBalance,
      stratBalance,
    };
  };

  // Deposits WETH into the staking strategy
  const depositToStrategy = async (amount) => {
    const { compoundingStakingSSVStrategy, weth, josh } = fixture;

    const amountWei = parseEther(amount.toString());
    await weth
      .connect(josh)
      .transfer(compoundingStakingSSVStrategy.address, amountWei);
    await compoundingStakingSSVStrategy.connect(sVault).depositAll();
  };

  describe("Register and stake validators", () => {
    beforeEach(async () => {
      const { weth, josh, ssv, compoundingStakingSSVStrategy } = fixture;

      await setERC20TokenBalance(
        compoundingStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      // Fund the strategy with WETH
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, ethUnits("5000"));
    });

    const stakeValidators = async (validators, amount = 32) => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const amountGwei = BigNumber.from(amount.toString()).mul(ETHInGwei);

      // there is a limitation to this function as it will only check for
      // a failure transaction with the last stake call
      for (const testValidator of testValidators.slice(0, validators)) {
        expect(
          await compoundingStakingSSVStrategy.validatorState(
            testValidator.publicKeyHash
          )
        ).to.equal(0, "Validator state not 0 (NON_REGISTERED)");

        const ssvAmount = ethUnits("2");
        // Register a new validator with the SSV Network
        const regTx = await compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .registerSsvValidator(
            testValidator.publicKey,
            testValidator.operatorIds,
            testValidator.sharesData,
            ssvAmount,
            emptyCluster
          );

        await expect(regTx)
          .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRegistered")
          .withArgs(testValidator.publicKeyHash, testValidator.operatorIds);

        expect(
          await compoundingStakingSSVStrategy.validatorState(
            testValidator.publicKeyHash
          )
        ).to.equal(1, "Validator state not 1 (REGISTERED)");

        // Stake ETH to the new validator

        const depositDataRoot = await calcDepositRoot(
          compoundingStakingSSVStrategy.address,
          "0x02",
          testValidator.publicKey,
          testValidator.signature,
          amount
        );

        const stakeTx = compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .stakeEth(
            {
              pubkey: testValidator.publicKey,
              signature: testValidator.signature,
              depositDataRoot,
            },
            amountGwei
          );

        await stakeTx;

        await expect(stakeTx)
          .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
          .withArgs(
            testValidator.publicKeyHash,
            depositDataRoot,
            testValidator.publicKey,
            amountGwei.mul(GweiInWei) // Convert Gwei to Wei
          );

        expect(
          await compoundingStakingSSVStrategy.validatorState(
            testValidator.publicKeyHash
          )
        ).to.equal(2, "Validator state not 2 (STAKED)");
      }
    };

    it("Should stake to a validator: 1 ETH", async () => {
      await stakeValidators(1, 1);
    });

    it("Should stake to 2 validators: 1 ETH", async () => {
      await stakeValidators(2, 1);
    });

    it("Should stake to 3 validators: 1 ETH", async () => {
      await stakeValidators(3, 1);
    });

    it("Should stake 1 ETH then 2047 ETH to a validator", async () => {
      const {
        compoundingStakingSSVStrategy,
        validatorRegistrator,
        beaconRoots,
        beaconOracle,
        weth,
      } = fixture;

      const testValidator = testValidators[0];

      const stratbalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          ethUnits("2"),
          emptyCluster
        );

      const depositDataRoot = await calcDepositRoot(
        compoundingStakingSSVStrategy.address,
        "0x02",
        testValidator.publicKey,
        testValidator.signature,
        1
      );

      // Stake 1 ETH to the new validator
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot,
          },
          ETHInGwei // 1e9 Gwei = 1 ETH
        );

      // The hash of the public key should match the leaf in the proof
      expect(hashPubKey(testValidator.publicKey)).to.equal(
        testValidator.publicKeyHash
      );

      // Set BeaconRoot for timestamp
      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.validatorProof.root
      );

      // Verify the validator
      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        testValidator.validatorProof.bytes
      );

      // Mock the deposit on the execution layer
      await beaconOracle.mapSlot(
        testValidator.depositProof.depositBlockNumber,
        testValidator.depositProof.depositSlot,
        testValidator.depositProof.depositRoot
      );

      // Mock the processing on the beacon chain
      await beaconOracle.mapSlot(
        testValidator.depositProof.processedBlockNumber,
        testValidator.depositProof.processedSlot,
        testValidator.depositProof.processedRoot
      );

      await compoundingStakingSSVStrategy.verifyDeposit(
        depositDataRoot,
        testValidator.depositProof.depositBlockNumber,
        testValidator.depositProof.processedSlot,
        testValidator.depositProof.firstPendingDepositSlot,
        testValidator.depositProof.proof
      );

      // Stake 2047 ETH to the new validator

      const secondDepositAmount = 2047;
      const depositDataRoot2 = await calcDepositRoot(
        compoundingStakingSSVStrategy.address,
        "0x02",
        testValidator.publicKey,
        testValidator.signature,
        secondDepositAmount
      );

      const stakeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: depositDataRoot2,
          },
          BigNumber.from(secondDepositAmount.toString()).mul(GweiInWei)
        );

      await expect(stakeTx)
        .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
        .withArgs(
          testValidator.publicKeyHash,
          depositDataRoot2,
          testValidator.publicKey,
          parseEther(secondDepositAmount.toString())
        );

      // Cheating here by using the same proof as before
      // it works as the deposit block is after the second deposit on the execution layer
      await compoundingStakingSSVStrategy.verifyDeposit(
        depositDataRoot2,
        testValidator.depositProof.depositBlockNumber,
        testValidator.depositProof.processedSlot,
        testValidator.depositProof.firstPendingDepositSlot,
        testValidator.depositProof.proof
      );

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(stratbalanceBefore);
    });

    it("Should revert when first stake amount is not exactly 1 ETH", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const testValidator = testValidators[0];

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          ethUnits("2"),
          emptyCluster
        );

      // Try to stake 32 ETH to the new validator
      const stakeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositProof.depositDataRoot,
          },
          BigNumber.from("32").mul(GweiInWei) // 32 ETH
        );

      await expect(stakeTx).to.be.revertedWith("First deposit not 1 ETH");
    });

    it("Should revert when registering a validator that is already registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const testValidator = testValidators[0];

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          ethUnits("2"),
          emptyCluster
        );

      // Try to register the same validator again
      await expect(
        compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .registerSsvValidator(
            testValidator.publicKey,
            testValidator.operatorIds,
            testValidator.sharesData,
            ethUnits("2"),
            emptyCluster
          )
      ).to.be.revertedWith("Validator already registered");
    });

    it("Should revert when staking because of insufficient ETH balance", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator, weth } =
        fixture;
      const testValidator = testValidators[0];
      let balance = await weth.balanceOf(compoundingStakingSSVStrategy.address);
      balance = balance.div(GweiInWei); // Convert from Wei to Gwei
      // Stake ETH to the unregistered validator
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositProof.depositDataRoot,
          },
          balance.add(1) // 1e9 Gwei = 1 ETH
        );

      await expect(tx).to.be.revertedWith("Insufficient WETH");
    });

    it("Should revert when staking a validator that hasn't been registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const testValidator = testValidators[0];

      // Stake ETH to the unregistered validator
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositProof.depositDataRoot,
          },
          ETHInGwei // 1e9 Gwei = 1 ETH
        );

      await expect(tx).to.be.revertedWith("Not registered or verified");
    });

    // Remove validator
    it("Should remove a validator when validator is registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const testValidator = testValidators[0];

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          ethUnits("2"),
          emptyCluster
        );

      expect(
        await compoundingStakingSSVStrategy.validatorState(
          testValidator.publicKeyHash
        )
      ).to.equal(1, "Validator state not 1 (REGISTERED)");

      // Withdraw from the validator
      const removeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          emptyCluster
        );

      await expect(removeTx)
        .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRemoved")
        .withArgs(testValidator.publicKeyHash, testValidator.operatorIds);
    });

    it("Should revert when removing a validator that is not registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const testValidator = testValidators[0];
      expect(
        await compoundingStakingSSVStrategy.validatorState(
          testValidator.publicKeyHash
        )
      ).to.equal(0, "Validator state not 0 (NON_REGISTERED)");

      // Try to remove a validator that is not registered
      const removeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          emptyCluster
        );

      await expect(removeTx).to.be.revertedWith("Validator not regd or exited");
    });

    it("Should remove a validator when validator is exited", async () => {
      const { weth, validatorRegistrator, compoundingStakingSSVStrategy } =
        fixture;

      await setERC20TokenBalance(
        compoundingStakingSSVStrategy.address,
        weth,
        parseEther("0")
      );
      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topupValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      // Validator has 1588.918094377 ETH
      const withdrawalAmount = testBalancesProofs[1].validatorBalances[2];

      // Stake before balance are verified
      const activeValidatorsBefore =
        await compoundingStakingSSVStrategy.getVerifiedValidators();
      expect(activeValidatorsBefore.length).to.eq(1);
      expect(
        await compoundingStakingSSVStrategy.validatorState(
          testValidators[3].publicKeyHash
        )
      ).to.equal(3); // VERIFIED

      // fund 1 WEI for the withdrawal request
      await setBalance(compoundingStakingSSVStrategy.address, "0x1");
      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(
          testValidators[3].publicKey,
          parseUnits(withdrawalAmount.toString(), 9)
        );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
        .withArgs(
          testValidators[3].publicKeyHash,
          parseEther(withdrawalAmount.toString())
        );

      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: withdrawalAmount,
        balancesProof: testBalancesProofs[2],
        activeValidators: [2],
      });

      const removeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidators[3].publicKey,
          testValidators[3].operatorIds,
          emptyCluster
        );

      await expect(removeTx)
        .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRemoved")
        .withArgs(
          testValidators[3].publicKeyHash,
          testValidators[3].operatorIds
        );
    });

    it("Should revert when removing a validator that has been found", async () => {
      await stakeValidators(1, 1);

      const testValidator = testValidators[0];

      const { compoundingStakingSSVStrategy } = fixture;

      expect(
        await compoundingStakingSSVStrategy.validatorState(
          testValidator.publicKeyHash
        )
      ).to.equal(2, "Validator state not 2 (STAKED)");
    });
  });

  describe("Deposit/Withdraw in the strategy", () => {
    it("Should deposit ETH in the strategy", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;
      const balBefore =
        await compoundingStakingSSVStrategy.depositedWethAccountedFor();
      const checkBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      const depositTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      await expect(depositTx)
        .to.emit(compoundingStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(
        balBefore.add(depositAmount),
        "Deposit amount not set properly"
      );
      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        checkBalanceBefore.add(depositAmount),
        "Check balance not updated properly"
      );
    });

    it("Should depositAll ETH in the strategy when depositedWethAccountedFor is zero", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      const checkBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);
      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      const balBefore =
        await compoundingStakingSSVStrategy.depositedWethAccountedFor();

      const depositTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .depositAll();

      await expect(depositTx)
        .to.emit(compoundingStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(
        balBefore.add(depositAmount),
        "Deposit amount not set properly"
      );

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        checkBalanceBefore.add(depositAmount),
        "Check balance not updated properly"
      );
    });

    it("Should depositAll ETH in the strategy when depositedWethAccountedFor is not zero", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      let depositAmount = parseEther("10");

      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      await compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      const balBefore =
        await compoundingStakingSSVStrategy.depositedWethAccountedFor();

      expect(balBefore).to.equal(
        depositAmount,
        "Deposit amount not set properly"
      );

      depositAmount = parseEther("20");

      const checkBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      // Josh deposits more ETH
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);

      const depositTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .depositAll();

      await expect(depositTx)
        .to.emit(compoundingStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(
        balBefore.add(depositAmount),
        "Deposit amount not set properly"
      );

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        checkBalanceBefore.add(depositAmount),
        "Check balance not updated properly"
      );
    });

    it("Should revert when depositing 0 ETH in the strategy", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      await expect(
        compoundingStakingSSVStrategy.connect(sVault).deposit(
          weth.address,
          0 // 0 ETH
        )
      ).to.be.revertedWith("Must deposit something");
    });

    it("Should withdraw ETH from the strategy, no ETH", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      await compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      const checkBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      const withdrawTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .withdraw(josh.address, weth.address, depositAmount);

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        checkBalanceBefore.sub(depositAmount),
        "Check balance not updated properly"
      );
    });

    it("Should withdraw ETH from the strategy, withdraw some ETH", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      await compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      // Donate raw ETH to the strategy
      await setBalance(compoundingStakingSSVStrategy.address, parseEther("5"));

      const checkBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      const withdrawTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .withdraw(
          josh.address,
          weth.address,
          depositAmount.add(parseEther("5"))
        );

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount.add(parseEther("5")));

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        checkBalanceBefore.sub(depositAmount), // The extra 5 ETH is raw ETH are not taken into account, this is expected behavior
        "Check balance not updated properly"
      );
    });

    it("Should withdraw ETH from the strategy, when lastVerifiedEthBalance > ethAmount", async () => {
      await processValidator(testValidators[0]);
      await topupValidator(testValidators[0], 32, "VERIFIED_DEPOSIT");
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 32,
        balancesProof: testBalancesProofs[0],
        activeValidators: [0],
      });
      // Give 5 raw eth to the strategy
      await setBalance(
        fixture.compoundingStakingSSVStrategy.address,
        parseEther("5")
      );

      const withdrawTx = fixture.compoundingStakingSSVStrategy
        .connect(sVault)
        .withdraw(fixture.josh.address, fixture.weth.address, parseEther("5"));

      await expect(withdrawTx)
        .to.emit(fixture.compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(fixture.weth.address, zero, parseEther("5"));
    });

    it("Should revert when withdrawing other than WETH", async () => {
      const { compoundingStakingSSVStrategy, josh } = fixture;

      // Try to withdraw USDC instead of WETH
      await expect(
        compoundingStakingSSVStrategy
          .connect(sVault)
          .withdraw(josh.address, josh.address, parseEther("10"))
      ).to.be.revertedWith("Unsupported asset");
    });

    it("Should revert when withdrawing 0 ETH from the strategy", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      await expect(
        compoundingStakingSSVStrategy.connect(sVault).withdraw(
          josh.address,
          weth.address, // 0 ETH
          0 // 0 amount
        )
      ).to.be.revertedWith("Must withdraw something");
    });

    it("Should revert when withdrawing to the zero address", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      await expect(
        compoundingStakingSSVStrategy.connect(sVault).withdraw(
          zero, // zero address
          weth.address,
          parseEther("10")
        )
      ).to.be.revertedWith("Must specify recipient");
    });

    it("Should withdrawAll ETH from the strategy, no ETH", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      await compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      const withdrawTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .withdrawAll();

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(0, "Check balance not updated properly");
    });

    it("Should withdrawAll ETH from the strategy, withdraw some ETH", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      const depositAmount = parseEther("10");
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, depositAmount);
      await compoundingStakingSSVStrategy
        .connect(sVault)
        .deposit(weth.address, depositAmount);

      // Donate raw ETH to the strategy
      await setBalance(compoundingStakingSSVStrategy.address, parseEther("5"));

      const withdrawTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .withdrawAll();

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount.add(parseEther("5")));

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(0, "Check balance not updated properly");
    });
  });

  describe("Strategy balances", () => {
    describe("When no execution rewards (ETH), no pending deposits and no active validators", () => {
      const verifyBalancesNoDepositsOrValidators = async (beaconBlockRoot) => {
        const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

        const tx = await compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .verifyBalances({
            blockRoot: beaconBlockRoot,
            firstPendingDepositSlot: 0,
            firstPendingDepositSlotProof: "0x",
            balancesContainerRoot: ethers.utils.hexZeroPad("0x0", 32),
            validatorContainerProof: "0x",
            validatorBalanceLeaves: [],
            validatorBalanceProofs: [],
          });

        return tx;
      };
      it("Should verify balances with no WETH", async () => {
        const { compoundingStakingSSVStrategy, weth } = fixture;

        const { beaconBlockRoot, timestamp } = await snapBalances();

        const tx = await verifyBalancesNoDepositsOrValidators(beaconBlockRoot);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
            0, // wethBalance
            0 // ethBalance
          );

        expect(
          await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
          "Last verified ETH balance"
        ).to.equal(0);
        expect(
          await compoundingStakingSSVStrategy.checkBalance(weth.address)
        ).to.equal(0);
      });
      it("Should verify balances with some WETH transferred before snap", async () => {
        const { compoundingStakingSSVStrategy, josh, weth } = fixture;

        // Send some WETH to the strategy before the snap
        const wethAmountAdded = parseEther("1.23");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountAdded);
        await compoundingStakingSSVStrategy.connect(sVault).depositAll();

        const { beaconBlockRoot, timestamp } = await snapBalances();

        const tx = await verifyBalancesNoDepositsOrValidators(beaconBlockRoot);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
            wethAmountAdded, // wethBalance
            0 // ethBalance
          );

        expect(
          await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
          "Last verified ETH balance"
        ).to.equal(0);
        expect(
          await compoundingStakingSSVStrategy.checkBalance(weth.address)
        ).to.equal(wethAmountAdded);
      });
      it("Should verify balances with some WETH transferred after snap", async () => {
        const { compoundingStakingSSVStrategy, josh, weth } = fixture;

        const { beaconBlockRoot, timestamp } = await snapBalances();

        // Send some WETH to the strategy after the snap
        const wethAmountAdded = parseEther("5.67");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountAdded);

        const tx = await verifyBalancesNoDepositsOrValidators(beaconBlockRoot);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
            wethAmountAdded, // wethBalance
            0 // ethBalance
          );

        expect(
          await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
          "Last verified ETH balance"
        ).to.equal(0);
        expect(
          await compoundingStakingSSVStrategy.checkBalance(weth.address)
        ).to.equal(wethAmountAdded);
      });
      it("Should verify balances with some WETH transferred before and after snap", async () => {
        const { compoundingStakingSSVStrategy, josh, weth } = fixture;

        // Send some WETH to the strategy before the snap
        const wethAmountBefore = parseEther("1.23");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountBefore);

        const { beaconBlockRoot, timestamp } = await snapBalances();

        // Send some WETH to the strategy after the snap
        const wethAmountAdded = parseEther("5.67");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountAdded);

        const tx = await verifyBalancesNoDepositsOrValidators(beaconBlockRoot);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
            wethAmountBefore.add(wethAmountAdded), // wethBalance
            0 // ethBalance
          );

        expect(
          await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
          "Last verified ETH balance"
        ).to.equal(0);
        expect(
          await compoundingStakingSSVStrategy.checkBalance(weth.address)
        ).to.equal(wethAmountBefore.add(wethAmountAdded));
      });
      it("Should verify balances with one registered validator", async () => {
        await processValidator(testValidators[0], "REGISTERED");

        const balancesAfter = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 10,
          ethAmount: 0,
          balancesProof: testBalancesProofs[2],
          activeValidators: [], // no active validators
        });

        expect(balancesAfter.wethBalance).to.equal(parseEther("10"));
        expect(balancesAfter.verifiedEthBalance).to.equal(0);
        expect(balancesAfter.stratBalance).to.equal(parseEther("10"));
      });
      it("Should verify balances with one staked validator", async () => {
        const blockNumberBefore = await ethers.provider.getBlockNumber();
        await processValidator(testValidators[0], "STAKED");

        const balancesAfter = await assertBalances({
          firstPendingDepositBlockNumber: blockNumberBefore,
          pendingDepositAmount: 1,
          wethAmount: 0,
          ethAmount: 0,
          balancesProof: testBalancesProofs[2],
          activeValidators: [], // no active validators
        });

        expect(balancesAfter.totalDepositsWei).to.equal(parseEther("1"));
        expect(balancesAfter.verifiedEthBalance).to.equal(parseEther("1"));
        expect(balancesAfter.stratBalance).to.equal(parseEther("1"));
      });
      it("Should verify balances with one verified validator", async () => {
        const blockNumberBefore = await ethers.provider.getBlockNumber();
        await processValidator(testValidators[0], "VERIFIED_VALIDATOR");

        const balancesAfter = await assertBalances({
          firstPendingDepositBlockNumber: blockNumberBefore,
          pendingDepositAmount: 1,
          wethAmount: 0,
          ethAmount: 0,
          balancesProof: testBalancesProofs[1],
          activeValidators: [0],
        });

        expect(balancesAfter.totalDepositsWei).to.equal(parseEther("1"));
        expect(balancesAfter.verifiedEthBalance).to.equal(parseEther("1"));
        expect(balancesAfter.stratBalance).to.equal(parseEther("1"));
      });
      it("Should verify balances with one verified deposit", async () => {
        await processValidator(testValidators[0], "VERIFIED_DEPOSIT");

        const balancesAfter = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 0,
          ethAmount: 0,
          balancesProof: testBalancesProofs[2],
          activeValidators: [0],
        });

        const expectedValidatorBalance = parseEther(
          testBalancesProofs[2].validatorBalances[0].toString()
        );
        expect(balancesAfter.totalDepositsWei).to.equal(0);
        expect(balancesAfter.totalValidatorBalance).to.equal(
          expectedValidatorBalance
        );
        expect(balancesAfter.verifiedEthBalance).to.equal(
          expectedValidatorBalance
        );
        expect(balancesAfter.stratBalance).to.equal(expectedValidatorBalance);
      });
    });
    describe("When an active validator does a", () => {
      let balancesBefore;
      beforeEach(async () => {
        // Third validator is later withdrawn later
        await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
        await topupValidator(
          testValidators[3],
          testValidators[3].depositProof.depositAmount - 1,
          "VERIFIED_DEPOSIT"
        );
      });
      describe("partial withdrawal", () => {
        beforeEach(async () => {
          balancesBefore = await assertBalances({
            pendingDepositAmount: 0,
            wethAmount: 0,
            ethAmount: 0,
            balancesProof: testBalancesProofs[0],
            activeValidators: [2],
          });
        });
        it("Should account for a pending partial withdrawal", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          const withdrawalAmount = 640;
          // fund 1 WEI for the withdrawal request
          await setBalance(compoundingStakingSSVStrategy.address, "0x1");
          const tx = await compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .validatorWithdrawal(
              testValidators[3].publicKey,
              parseUnits(withdrawalAmount.toString(), 9)
            );

          await expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
            .withArgs(
              testValidators[3].publicKeyHash,
              parseEther(withdrawalAmount.toString())
            );

          const balancesAfter = await assertBalances({
            pendingDepositAmount: 0,
            wethAmount: 0,
            ethAmount: 0,
            balancesProof: testBalancesProofs[0],
            activeValidators: [2],
          });
          expect(balancesAfter.stratBalance).to.equal(
            balancesBefore.stratBalance
          );
        });
        it("Should account for a processed partial withdrawal", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          const withdrawalAmount = 640;
          // fund 1 WEI for the withdrawal request
          await setBalance(compoundingStakingSSVStrategy.address, "0x1");
          const tx = await compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .validatorWithdrawal(
              testValidators[3].publicKey,
              parseUnits(withdrawalAmount.toString(), 9)
            );

          await expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
            .withArgs(
              testValidators[3].publicKeyHash,
              parseEther(withdrawalAmount.toString())
            );

          const concensusRewards =
            testBalancesProofs[0].validatorBalances[2] -
            testBalancesProofs[1].validatorBalances[2] -
            withdrawalAmount;

          const balancesAfter = await assertBalances({
            pendingDepositAmount: 0,
            wethAmount: 0,
            ethAmount: withdrawalAmount + concensusRewards,
            balancesProof: testBalancesProofs[1],
            activeValidators: [2],
          });
          expect(balancesAfter.stratBalance).to.equal(
            balancesBefore.stratBalance
          );
        });
      });
      describe("full withdrawal", () => {
        beforeEach(async () => {
          balancesBefore = await assertBalances({
            pendingDepositAmount: 0,
            wethAmount: 0,
            ethAmount: 0,
            balancesProof: testBalancesProofs[1],
            activeValidators: [2],
          });
        });
        it("Should account for full withdrawal", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          // Validator has 1588.918094377 ETH
          const withdrawalAmount = testBalancesProofs[1].validatorBalances[2];

          // Stake before balance are verified
          const activeValidatorsBefore =
            await compoundingStakingSSVStrategy.getVerifiedValidators();
          expect(activeValidatorsBefore.length).to.eq(1);
          expect(
            await compoundingStakingSSVStrategy.validatorState(
              testValidators[3].publicKeyHash
            )
          ).to.equal(3); // VERIFIED

          // fund 1 WEI for the withdrawal request
          await setBalance(compoundingStakingSSVStrategy.address, "0x1");
          const tx = await compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .validatorWithdrawal(
              testValidators[3].publicKey,
              parseUnits(withdrawalAmount.toString(), 9)
            );

          await expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
            .withArgs(
              testValidators[3].publicKeyHash,
              parseEther(withdrawalAmount.toString())
            );

          const balancesAfter = await assertBalances({
            pendingDepositAmount: 0,
            wethAmount: 0,
            ethAmount: withdrawalAmount,
            balancesProof: testBalancesProofs[2],
            activeValidators: [2],
          });

          // Check state after the balances are verified
          expect(balancesAfter.stratBalance).to.equal(
            balancesBefore.stratBalance
          );
          const activeValidatorsAfter =
            await compoundingStakingSSVStrategy.getVerifiedValidators();
          expect(activeValidatorsAfter.length).to.eq(0);
          expect(
            await compoundingStakingSSVStrategy.validatorState(
              testValidators[3].publicKeyHash
            )
          ).to.equal(4); // EXITED
        });
      });
    });
    describe("When WETH, ETH, no pending deposits and 2 active validators", () => {
      let balancesBefore;
      beforeEach(async () => {
        // register, stake, verify validator and verify deposit
        await processValidator(testValidators[0], "VERIFIED_DEPOSIT");
        await topupValidator(
          testValidators[0],
          testValidators[0].depositProof.depositAmount - 1,
          "VERIFIED_DEPOSIT"
        );

        await processValidator(testValidators[1], "VERIFIED_DEPOSIT");
        await topupValidator(
          testValidators[1],
          testValidators[1].depositProof.depositAmount - 1,
          "VERIFIED_DEPOSIT"
        );

        balancesBefore = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 10,
          ethAmount: 0.987,
          balancesProof: testBalancesProofs[3],
          activeValidators: [0, 1],
        });
      });
      it("consensus rewards are earned by the validators", async () => {
        const balancesAfter = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 10,
          ethAmount: 0.987,
          balancesProof: testBalancesProofs[4],
          activeValidators: [0, 1],
        });

        // Check the increase in consensus rewards
        const consensusRewards = parseEther("0.007672545");
        expect(balancesAfter.totalValidatorBalance).to.equal(
          balancesBefore.totalValidatorBalance.add(consensusRewards)
        );
        expect(balancesAfter.totalBalance).to.equal(
          balancesBefore.totalBalance.add(consensusRewards)
        );
      });
      it("execution rewards are earned as ETH in the strategy", async () => {
        const balancesAfter = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 10,
          ethAmount: 1,
          balancesProof: testBalancesProofs[3],
          activeValidators: [0, 1],
        });

        // Check the increase in execution rewards
        const executionRewards = parseEther("0.013");
        expect(balancesAfter.ethBalance).to.equal(
          balancesBefore.ethBalance.add(executionRewards)
        );
        expect(balancesAfter.totalBalance).to.equal(
          balancesBefore.totalBalance.add(executionRewards)
        );
      });
    });
    describe.skip("When some WETH, ETH, 3 pending deposits and 16 active validators", () => {
      let balancesBefore;
      beforeEach(async () => {
        // register, stake, verify validator and verify deposit
        for (let i = 0; i < 6; i++) {
          // if (i === 4) continue; // Skip the 5th validator for this test
          console.log(`Processing validator ${i}`);
          await processValidator(testValidators[i], "VERIFIED_DEPOSIT");
          console.log(`Toping up validator ${i}`);
          // Top up the validator to ensure it has enough balance
          await topupValidator(
            testValidators[i],
            testValidators[i].depositProof.depositAmount - 1,
            "VERIFIED_DEPOSIT"
          );
        }

        balancesBefore = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 123.456,
          ethAmount: 12.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: [0, 1, 2, 3, 4],
        });
      });
      it("consensus rewards are earned by the validators", async () => {
        const balancesAfter = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 123.456,
          ethAmount: 13.345,
          balancesProof: testBalancesProofs[4],
          activeValidators: [0, 1],
        });
        // Check the increase in consensus rewards
        const consensusRewards = parseEther("1");
        expect(balancesAfter.totalValidatorBalance).to.equal(
          balancesBefore.totalValidatorBalance.add(consensusRewards)
        );
        expect(balancesAfter.totalBalance).to.equal(
          balancesBefore.totalBalance.add(consensusRewards)
        );
      });
    });
  });

  describe("Consolidation", () => {
    beforeEach(async () => {
      // It should add josh as a source strategy
      const { compoundingStakingSSVStrategy, josh } = fixture;
      await compoundingStakingSSVStrategy
        .connect(sGov)
        .addSourceStrategy(josh.address);
    });
    it("Should request consolidation", async () => {
      const { compoundingStakingSSVStrategy, josh } = fixture;

      await processValidator(testValidators[0], "VERIFIED_DEPOSIT");

      expect(await compoundingStakingSSVStrategy.paused()).to.be.false;

      const consolidation = await compoundingStakingSSVStrategy
        .connect(josh)
        .requestConsolidation(
          testValidators[1].publicKeyHash,
          testValidators[0].publicKeyHash
        );

      expect(consolidation)
        .to.emit(compoundingStakingSSVStrategy, "Paused")
        .withArgs(josh.address);
      expect(consolidation)
        .to.emit(compoundingStakingSSVStrategy, "ConsolidationRequested")
        .withArgs(
          testValidators[1].publicKeyHash,
          testValidators[0].publicKeyHash,
          josh.address
        );

      expect(await compoundingStakingSSVStrategy.paused()).to.be.true;

      expect(await compoundingStakingSSVStrategy.lastSnapTimestamp()).to.equal(
        0,
        "Last snap timestamp should be 0 before consolidation"
      );
      expect(
        await compoundingStakingSSVStrategy.consolidationLastPubKeyHash()
      ).to.equal(
        testValidators[1].publicKeyHash,
        "Consolidation last pubkey hash should be set"
      );
      expect(
        await compoundingStakingSSVStrategy.consolidationSourceStrategy()
      ).to.equal(
        josh.address,
        "Consolidation last source pubkey hash should be set"
      );
    });

    it("Should revert when requesting consolidation because not a source strategy", async () => {
      const { compoundingStakingSSVStrategy, matt } = fixture;
      await expect(
        compoundingStakingSSVStrategy
          .connect(matt)
          .requestConsolidation(
            testValidators[1].publicKeyHash,
            testValidators[0].publicKeyHash
          )
      ).to.be.revertedWith("Not a source strategy");
    });

    it("Should revert when requesting consolidation because already paused", async () => {
      const { compoundingStakingSSVStrategy, josh } = fixture;
      await processValidator(testValidators[0], "VERIFIED_DEPOSIT");

      await compoundingStakingSSVStrategy
        .connect(josh)
        .requestConsolidation(
          testValidators[1].publicKeyHash,
          testValidators[0].publicKeyHash
        );

      await expect(
        compoundingStakingSSVStrategy
          .connect(josh)
          .requestConsolidation(
            testValidators[1].publicKeyHash,
            testValidators[0].publicKeyHash
          )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert when requesting consolidation because no active validators", async () => {
      const { compoundingStakingSSVStrategy, josh } = fixture;
      await expect(
        compoundingStakingSSVStrategy
          .connect(josh)
          .requestConsolidation(
            testValidators[1].publicKeyHash,
            testValidators[0].publicKeyHash
          )
      ).to.be.revertedWith("Target validator not verified");
    });

    it("Should revert when verifying consolidation because not registrator", async () => {
      const { compoundingStakingSSVStrategy, matt } = fixture;
      await expect(
        compoundingStakingSSVStrategy
          .connect(matt)
          .verifyConsolidation(
            0,
            0,
            testValidators[0].publicKey,
            testBalancesProofs[0].validatorBalanceLeaves[0],
            testBalancesProofs[0].validatorBalanceProofs[0]
          )
      ).to.be.revertedWith("Not Registrator");
    });

    it("Should revert when verifying consolidation because no consolidation", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;
      await expect(
        compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .verifyConsolidation(
            0,
            0,
            testValidators[0].publicKey,
            testBalancesProofs[0].validatorBalanceLeaves[0],
            testBalancesProofs[0].validatorBalanceProofs[0]
          )
      ).to.be.revertedWith("No consolidations");
    });

    it("Should revert when verifying consolidation because invalid balance proof", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator, josh } =
        fixture;
      await processValidator(testValidators[0], "VERIFIED_DEPOSIT");
      await processValidator(testValidators[1], "VERIFIED_DEPOSIT");
      await compoundingStakingSSVStrategy
        .connect(josh)
        .requestConsolidation(
          testValidators[1].publicKeyHash,
          testValidators[0].publicKeyHash
        );

      await expect(
        compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .verifyConsolidation(
            testValidators[1].validatorProof.nextBlockTimestamp,
            testValidators[1].index,
            testValidators[1].validatorProof.bytes,
            testBalancesProofs[0].validatorBalanceLeaves[0],
            testBalancesProofs[0].validatorBalanceProofs[0]
          )
      ).to.be.revertedWith("Invalid balance proof");
    });

    it.skip("Should revert when verifying consolidation because last validator balance not zero", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator, josh } =
        fixture;
      await processValidator(testValidators[0], "VERIFIED_DEPOSIT");
      await processValidator(testValidators[1], "VERIFIED_DEPOSIT");
      await compoundingStakingSSVStrategy
        .connect(josh)
        .requestConsolidation(
          testValidators[0].publicKeyHash,
          testValidators[1].publicKeyHash
        );

      // WIP
      await expect(
        compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .verifyConsolidation(
            testValidators[0].validatorProof.nextBlockTimestamp,
            testValidators[0].index,
            testValidators[0].validatorProof.bytes,
            testBalancesProofs[0].validatorBalanceLeaves[2],
            testBalancesProofs[0].validatorBalanceProofs[2]
          )
      ).to.be.revertedWith("Last validator balance not zero");
    });
  });
  /*
  it("Deposit alternate deposit_data_root ", async () => {
    const { depositContractUtils } = fixture;

    const withdrawalCredentials = solidityPack(
      ["bytes1", "bytes11", "address"],
      [
        "0x01",
        "0x0000000000000000000000",
        // mainnet Native Staking Strategy proxy
        "0x34edb2ee25751ee67f68a45813b22811687c0238",
      ]
    );
    expect(withdrawalCredentials).to.equal(
      "0x01000000000000000000000034edb2ee25751ee67f68a45813b22811687c0238"
    );

    const expectedDepositDataRoot =
      await depositContractUtils.calculateDepositDataRoot(
        // Mainnet fork test public key
        "0xaba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25",
        withdrawalCredentials,
        // Mainnet fork test signature
        "0x90157a1c1b26384f0b4d41bec867d1a000f75e7b634ac7c4c6d8dfc0b0eaeb73bcc99586333d42df98c6b0a8c5ef0d8d071c68991afcd8fbbaa8b423e3632ee4fe0782bc03178a30a8bc6261f64f84a6c833fb96a0f29de1c34ede42c4a859b0"
      );

    expect(
      "0xf7d704e25a2b5bea06fafa2dfe5c6fa906816e5c1622400339b2088a11d5f446"
    ).to.equal(expectedDepositDataRoot, "Incorrect deposit data root");
  });
  */
});
