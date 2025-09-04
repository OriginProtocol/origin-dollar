const { expect } = require("chai");
const { network } = require("hardhat");
const { BigNumber, Wallet } = require("ethers");
const { parseEther, parseUnits } = require("ethers").utils;
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256, ZERO_BYTES32 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const { ethUnits, advanceTime } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { zero } = require("../../utils/addresses");
const { calcDepositRoot } = require("../../tasks/beaconTesting");
const { logDeposits } = require("../../tasks/validatorCompound");
const {
  hashPubKey,
  calcSlot,
  calcEpoch,
  calcBlockTimestamp,
} = require("../../utils/beacon");
const { randomBytes } = require("crypto");
const {
  testValidators,
  testBalancesProofs,
} = require("./compoundingSSVStaking-validatorsData.json");

const log = require("../../utils/logger")(
  "test:unit:strategy:compoundingSSVStaking"
);

const {
  createFixtureLoader,
  compoundingStakingSSVStrategyFixture,
  compoundingStakingSSVStrategyMerkleProofsMockedFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(compoundingStakingSSVStrategyFixture);
const loadFixtureMockedProofs = createFixtureLoader(
  compoundingStakingSSVStrategyMerkleProofsMockedFixture
);

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

    it("Should support WETH as the only asset", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      const assets = await compoundingStakingSSVStrategy.supportsAsset(
        weth.address
      );
      expect(assets).to.equal(true);
    });
    it("Should not collect rewards", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      await compoundingStakingSSVStrategy
        .connect(governor)
        .setHarvesterAddress(governor.address);

      const collectRewards = compoundingStakingSSVStrategy
        .connect(governor)
        .collectRewardTokens();
      await expect(collectRewards).to.revertedWith("Unsupported function");
    });
    it("Non governor should not be able to reset the first deposit flag", async () => {
      const { compoundingStakingSSVStrategy, strategist, josh } = fixture;

      const signers = [strategist, josh];
      for (const signer of signers) {
        await expect(
          compoundingStakingSSVStrategy.connect(signer).resetFirstDeposit()
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });
    it("Should revert reset of first deposit if there is no first deposit", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      await expect(
        compoundingStakingSSVStrategy.connect(governor).resetFirstDeposit()
      ).to.be.revertedWith("No first deposit");
    });
  });

  const processValidator = async (
    testValidator,
    state = "VERIFIED_DEPOSIT"
  ) => {
    const { beaconRoots, compoundingStakingSSVStrategy, validatorRegistrator } =
      fixture;

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
    const depositID = await compoundingStakingSSVStrategy.nextDepositID();

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
    const stakeReceipt = await stakeTx.wait();
    const depositBlock = await ethers.provider.getBlock(
      stakeReceipt.blockNumber
    );
    const depositSlot = calcSlot(depositBlock.timestamp);

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
        compoundingStakingSSVStrategy.address,
        testValidator.validatorProof.bytes
      );

    if (state === "VERIFIED_VALIDATOR") return verifiedValidatorTx;

    // Set parent beacon root for the block after the verification slots
    const depositProcessedSlot = depositSlot + 10000n;

    await beaconRoots["setBeaconRoot(uint256,bytes32)"](
      calcBlockTimestamp(depositProcessedSlot) + 12n,
      testValidator.depositProof.processedBeaconBlockRoot
    );

    const verifiedDepositTx = await compoundingStakingSSVStrategy.verifyDeposit(
      depositID,
      depositProcessedSlot,
      testValidator.depositProof.firstPendingDeposit,
      testValidator.depositProof.strategyValidator
    );

    if (state === "VERIFIED_DEPOSIT") return verifiedDepositTx;

    throw Error(`Invalid state: ${state}`);
  };

  const topUpValidator = async (
    testValidator,
    depositAmount,
    state = "VERIFIED_DEPOSIT"
  ) => {
    const { beaconRoots, compoundingStakingSSVStrategy, validatorRegistrator } =
      fixture;

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
    const depositID = await compoundingStakingSSVStrategy.nextDepositID();

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
    const stakeReceipt = await stakeTx.wait();
    const depositBlock = await ethers.provider.getBlock(
      stakeReceipt.blockNumber
    );
    const depositSlot = calcSlot(depositBlock.timestamp);

    if (state === "STAKED") return stakeTx;

    // Set parent beacon root for the block after the verification slots
    const depositProcessedSlot = depositSlot + 10000n;
    // Put the slot the validator of the first pending deposit was created one epoch later
    const firstDepositValidatorCreatedSlot = depositProcessedSlot + 32n;

    await beaconRoots["setBeaconRoot(uint256,bytes32)"](
      calcBlockTimestamp(depositProcessedSlot) + 12n,
      testValidator.depositProof.processedBeaconBlockRoot
    );
    await beaconRoots["setBeaconRoot(uint256,bytes32)"](
      calcBlockTimestamp(firstDepositValidatorCreatedSlot) + 12n,
      testValidator.depositProof.validatorBeaconBlockRoot
    );

    const verifiedDepositTx = await compoundingStakingSSVStrategy.verifyDeposit(
      depositID,
      depositProcessedSlot,
      testValidator.depositProof.firstPendingDeposit,
      testValidator.depositProof.strategyValidator
    );

    if (state === "VERIFIED_DEPOSIT") return verifiedDepositTx;

    throw Error(`Invalid state: ${state}`);
  };

  // call right after depositing to the strategy
  const getLastDeposit = async (compoundingStakingSSVStrategy) => {
    const lastBlock = await ethers.provider.getBlock("latest");
    // roughly the deposit slot
    const depositSlot = calcSlot(lastBlock.timestamp);

    let depositID = await compoundingStakingSSVStrategy.nextDepositID();
    // - 1 to get the previously staked deposit id
    depositID = depositID.sub(BigNumber.from("1"));

    return {
      depositSlot,
      depositID,
    };
  };

  const snapBalances = async (beaconBlockRoot) => {
    const { compoundingStakingSSVStrategy, beaconRoots, validatorRegistrator } =
      fixture;

    if (!beaconBlockRoot) {
      beaconBlockRoot = "0x" + randomBytes(32).toString("hex");
    }

    // Disable auto-mining dynamically
    await network.provider.send("evm_setAutomine", [false]);

    await beaconRoots["setBeaconRoot(bytes32)"](beaconBlockRoot);

    await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .snapBalances();

    // Mine both txs
    await ethers.provider.send("evm_mine", []);
    // Enable auto-mining
    await network.provider.send("evm_setAutomine", [true]);

    const lastBlock = await ethers.provider.getBlock("latest");

    return { beaconBlockRoot, timestamp: lastBlock.timestamp };
  };

  const assertBalances = async ({
    wethAmount,
    ethAmount,
    balancesProof,
    pendingDepositAmount,
    activeValidators,
  }) => {
    const { beaconRoots, compoundingStakingSSVStrategy, weth } = fixture;

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

    const { timestamp: snapBalancesTimestamp } = await snapBalances(
      balancesProof.snapBalancesBlockRoot
    );

    const filteredLeaves =
      balancesProof.balanceProofs.validatorBalanceLeaves.filter((_, index) =>
        activeValidators.includes(index)
      );
    const filteredProofs =
      balancesProof.balanceProofs.validatorBalanceProofs.filter((_, index) =>
        activeValidators.includes(index)
      );
    const filteredBalances = balancesProof.validatorBalances.filter(
      (_, index) => activeValidators.includes(index)
    );

    // Put the slot the validator of the first pending deposit was created one epoch later
    const validatorVerificationBlockTimestamp = snapBalancesTimestamp + 12 * 32;

    await beaconRoots["setBeaconRoot(uint256,bytes32)"](
      validatorVerificationBlockTimestamp,
      balancesProof.firstDepositValidatorBlockRoot
    );

    // Verify balances with pending deposits and active validators
    const tx = await compoundingStakingSSVStrategy.verifyBalances(
      validatorVerificationBlockTimestamp,
      balancesProof.firstPendingDeposit,
      {
        ...balancesProof.balanceProofs,
        validatorBalanceLeaves: filteredLeaves,
        validatorBalanceProofs: filteredProofs,
      }
    );

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
      tx,
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

  describe("Register, stake, withdraw and remove validators", () => {
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

    const stakeValidators = async (testValidatorIndex, amount = 1) => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const amountGwei = BigNumber.from(amount.toString()).mul(ETHInGwei);

      // there is a limitation to this function as it will only check for
      // a failure transaction with the last stake call
      // for (const testValidator of testValidators.slice(0, validators)) {
      const testValidator = testValidators[testValidatorIndex];
      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
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
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
      ).to.equal(1, "Validator state not 1 (REGISTERED)");

      // Stake ETH to the new validator

      const depositDataRoot = await calcDepositRoot(
        compoundingStakingSSVStrategy.address,
        "0x02",
        testValidator.publicKey,
        testValidator.signature,
        amount
      );

      const expectedDepositId =
        await compoundingStakingSSVStrategy.nextDepositID();

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
          expectedDepositId,
          testValidator.publicKey,
          amountGwei.mul(GweiInWei) // Convert Gwei to Wei
        );

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
      ).to.equal(2, "Validator state not 2 (STAKED)");
      expect(await compoundingStakingSSVStrategy.nextDepositID()).to.equal(
        expectedDepositId.add(1)
      );
    };

    it("Should stake to a validator: 1 ETH", async () => {
      await stakeValidators(0, 1);
    });

    it("Should stake 1 ETH then 2047 ETH to a validator", async () => {
      const {
        compoundingStakingSSVStrategy,
        validatorRegistrator,
        beaconRoots,
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
      let depositID = await compoundingStakingSSVStrategy.nextDepositID();

      // Stake 1 ETH to the new validator
      let stakeTx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot,
          },
          ETHInGwei.mul(1) // 1 ETH
        );
      const stakeReceipt = await stakeTx.wait();
      const depositBlock = await ethers.provider.getBlock(
        stakeReceipt.blockNumber
      );
      const depositSlot = calcSlot(depositBlock.timestamp);

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
        compoundingStakingSSVStrategy.address,
        testValidator.validatorProof.bytes
      );

      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = depositSlot + 10000n;
      // Put the slot the validator of the first pending deposit was created one epoch later
      const firstDepositValidatorCreatedSlot = depositProcessedSlot + 32n;

      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );
      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(firstDepositValidatorCreatedSlot) + 12n,
        testValidator.depositProof.validatorBeaconBlockRoot
      );

      await compoundingStakingSSVStrategy.verifyDeposit(
        depositID,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
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

      stakeTx = compoundingStakingSSVStrategy
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
          ++depositID,
          testValidator.publicKey,
          parseEther(secondDepositAmount.toString())
        );

      // Cheating here by using the same proof as before
      // it works as the deposit block is after the second deposit on the execution layer
      await compoundingStakingSSVStrategy.verifyDeposit(
        depositID,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(stratbalanceBefore);
    });

    it("Should revert when first stake amount is not exactly 32 ETH", async () => {
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
          BigNumber.from("2").mul(GweiInWei)
        );

      await expect(stakeTx).to.be.revertedWith("Invalid first deposit amount");
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

    // Full validator exit

    it("Should exit a validator with no pending deposit", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, {
          value: 1,
        });

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
        .withArgs(testValidators[3].publicKeyHash, 0);

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidators[3].publicKeyHash
          )
        ).state
      ).to.equal(4); // EXITING
    });

    it("Should revert when exiting a validator with a pending deposit", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      // Stake but do not verify the deposit
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "STAKED"
      );

      // Amount 0 is a full validator exit
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, { value: 1 });

      await expect(tx).to.be.revertedWith("Pending deposit");
    });

    it("Should revert when verifying deposit between snapBalances and verifyBalances", async () => {
      const { beaconRoots, compoundingStakingSSVStrategy } = fixture;
      const testValidator = testValidators[3];

      // Third validator is later withdrawn later
      const verifyTx = await processValidator(
        testValidator,
        "VERIFIED_VALIDATOR"
      );

      const verifyReceipt = await verifyTx.wait();
      const verifyBlock = await ethers.provider.getBlock(
        verifyReceipt.blockNumber
      );
      // roughly the deposit slot
      const depositSlot = calcSlot(verifyBlock.timestamp);

      let depositID = await compoundingStakingSSVStrategy.nextDepositID();
      // - 1 to get the previously staked deposit id
      depositID = depositID.sub(BigNumber.from("1"));

      // Snap balances before the deposit is processed
      await compoundingStakingSSVStrategy.snapBalances();

      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = depositSlot + 10000n;

      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      const verifiedDepositTx = compoundingStakingSSVStrategy.verifyDeposit(
        depositID,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(verifiedDepositTx).to.be.revertedWith(
        "Deposit after balance snapshot"
      );
    });

    it("Should partial withdraw from a validator with a pending deposit", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      // Stake but do not verify the deposit
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "STAKED"
      );

      const withdrawAmountGwei = ETHInGwei.mul(5);

      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, withdrawAmountGwei, {
          value: 1,
        });

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
        .withArgs(
          testValidators[3].publicKeyHash,
          withdrawAmountGwei.mul(GweiInWei)
        );

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidators[3].publicKeyHash
          )
        ).state
      ).to.equal(3); // VERIFIED
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
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
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
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
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
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      // Validator has 1588.918094377 ETH
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      // Verify the validator with a zero balance which marks the validator as exited
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[2],
        activeValidators: [2],
      });

      const removeTx = await compoundingStakingSSVStrategy
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
      await stakeValidators(0, 1);

      const testValidator = testValidators[0];

      const { compoundingStakingSSVStrategy } = fixture;

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
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
      await topUpValidator(testValidators[0], 32, "VERIFIED_DEPOSIT");
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
      const verifyBalancesNoDepositsOrValidators = async (
        validatorVerificationBlockTimestamp
      ) => {
        const { compoundingStakingSSVStrategy } = fixture;

        const tx = await compoundingStakingSSVStrategy.verifyBalances(
          validatorVerificationBlockTimestamp,
          {
            slot: 0,
            validatorIndex: 0,
            pubKeyHash: ZERO_BYTES32,
            pendingDepositPubKeyProof: "0x",
            withdrawableEpochProof: "0x",
            validatorPubKeyProof: "0x",
          },
          {
            balancesContainerRoot: ZERO_BYTES32,
            balancesContainerProof: "0x",
            validatorBalanceLeaves: [],
            validatorBalanceProofs: [],
          }
        );

        return tx;
      };
      it("Should verify balances with no WETH", async () => {
        const { compoundingStakingSSVStrategy, weth } = fixture;

        const { timestamp } = await snapBalances();

        const tx = await verifyBalancesNoDepositsOrValidators(timestamp);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
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

        const { timestamp } = await snapBalances();

        const tx = await verifyBalancesNoDepositsOrValidators(timestamp);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
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

        const { timestamp } = await snapBalances();

        // Send some WETH to the strategy after the snap
        const wethAmountAdded = parseEther("5.67");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountAdded);

        const tx = await verifyBalancesNoDepositsOrValidators(timestamp);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
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

        const { timestamp } = await snapBalances();

        // Send some WETH to the strategy after the snap
        const wethAmountAdded = parseEther("5.67");
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, wethAmountAdded);

        const tx = await verifyBalancesNoDepositsOrValidators(timestamp);

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
          .withArgs(
            timestamp,
            0, // totalDepositsWei
            0, // totalValidatorBalance
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

        const depositAmountWei = parseEther("1");
        expect(balancesAfter.totalDepositsWei).to.equal(depositAmountWei);
        expect(balancesAfter.verifiedEthBalance).to.equal(depositAmountWei);
        expect(balancesAfter.stratBalance).to.equal(depositAmountWei);
      });
      it.skip("Should verify balances with one verified validator", async () => {
        // TODO need to fix this with a proof that the first pending deposit slot is after
        // when stakeEth was called
        const blockNumberBefore = await ethers.provider.getBlockNumber();
        // Test validator has index 1897126
        await processValidator(testValidators[3], "VERIFIED_VALIDATOR");

        const { compoundingStakingStrategyView } = fixture;
        await logDeposits(compoundingStakingStrategyView);

        const balancesAfter = await assertBalances({
          firstPendingDepositBlockNumber: blockNumberBefore,
          pendingDepositAmount: 1,
          wethAmount: 0,
          ethAmount: 0,
          // Validator 1897126 has a zero balance
          balancesProof: testBalancesProofs[5],
          activeValidators: [3],
        });

        const depositAmountWei = parseEther("1");
        expect(balancesAfter.totalDepositsWei).to.equal(depositAmountWei);
        expect(balancesAfter.verifiedEthBalance).to.equal(depositAmountWei);
        expect(balancesAfter.stratBalance).to.equal(depositAmountWei);
      });

      it("Should not verify a validator with incorrect withdrawal credential validator type", async () => {
        const originalValidatorProof = testValidators[0].validatorProof.bytes;
        // replace the 0x02 validator type credentials to an invalid 0x01 one
        const wrongValidatorTypeProof =
          "0x01" + originalValidatorProof.substring(4);
        testValidators[0].validatorProof.bytes = wrongValidatorTypeProof;

        await expect(
          processValidator(testValidators[0], "VERIFIED_DEPOSIT")
        ).to.be.revertedWith("Invalid withdrawal cred");

        testValidators[0].validatorProof.bytes = originalValidatorProof;
      });

      it("Should not verify a validator with incorrect withdrawal zero padding", async () => {
        const originalValidatorProof = testValidators[0].validatorProof.bytes;
        // replace the 0x02 validator type credentials to an invalid 0x01 one
        const wrongValidatorTypeProof =
          "0x020001" + originalValidatorProof.substring(8);
        testValidators[0].validatorProof.bytes = wrongValidatorTypeProof;

        await expect(
          processValidator(testValidators[0], "VERIFIED_DEPOSIT")
        ).to.be.revertedWith("Invalid withdrawal cred");

        testValidators[0].validatorProof.bytes = originalValidatorProof;
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
        await topUpValidator(
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
          const {
            compoundingStakingSSVStrategy,
            compoundingStakingStrategyView,
            validatorRegistrator,
          } = fixture;

          // Validator has 1588.918094377 ETH
          const withdrawalAmount = testBalancesProofs[1].validatorBalances[2];

          // Stake before balance are verified
          const activeValidatorsBefore =
            await compoundingStakingStrategyView.getVerifiedValidators();
          expect(activeValidatorsBefore.length).to.eq(1);
          expect(
            (
              await compoundingStakingSSVStrategy.validator(
                testValidators[3].publicKeyHash
              )
            ).state
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
            await compoundingStakingStrategyView.getVerifiedValidators();
          expect(activeValidatorsAfter.length).to.eq(0);
          expect(
            (
              await compoundingStakingSSVStrategy.validator(
                testValidators[3].publicKeyHash
              )
            ).state
          ).to.equal(5); // EXITED
        });
      });
    });
    describe("When WETH, ETH, no pending deposits and 2 active validators", () => {
      let balancesBefore;
      beforeEach(async () => {
        // register, stake, verify validator and verify deposit
        await processValidator(testValidators[0], "VERIFIED_DEPOSIT");
        await topUpValidator(
          testValidators[0],
          testValidators[0].depositProof.depositAmount - 1,
          "VERIFIED_DEPOSIT"
        );

        await processValidator(testValidators[1], "VERIFIED_DEPOSIT");
        await topUpValidator(
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
      describe("when balances have been snapped", () => {
        const balancesProof = testBalancesProofs[3];
        beforeEach(async () => {
          await snapBalances(balancesProof.snapBalancesBlockRoot);
        });
        it("Fail to verify balances with not enough validator leaves", async () => {
          const { compoundingStakingSSVStrategy } = fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy.verifyBalances(
            balancesProof.firstDepositValidatorBlockTimestamp,
            balancesProof.firstPendingDeposit,
            {
              ...balancesProof.balanceProofs,
              // Only one when there is three active validators
              validatorBalanceLeaves: [
                balancesProof.balanceProofs.validatorBalanceLeaves[0],
              ],
              validatorBalanceProofs: [
                balancesProof.balanceProofs.validatorBalanceProofs[0],
                balancesProof.balanceProofs.validatorBalanceProofs[1],
              ],
            }
          );

          await expect(tx).to.be.revertedWith("Invalid balance leaves");
        });
        it("Fail to verify balances with too many validator leaves", async () => {
          const { compoundingStakingSSVStrategy } = fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy.verifyBalances(
            balancesProof.firstDepositValidatorBlockTimestamp,
            balancesProof.firstPendingDeposit,
            {
              ...balancesProof.balanceProofs,
              // Three when there is two active validators
              validatorBalanceLeaves:
                balancesProof.balanceProofs.validatorBalanceLeaves,
              validatorBalanceProofs: [
                balancesProof.balanceProofs.validatorBalanceProofs[0],
                balancesProof.balanceProofs.validatorBalanceProofs[1],
              ],
            }
          );

          await expect(tx).to.be.revertedWith("Invalid balance leaves");
        });
        it("Fail to verify balances with not enough validator proofs", async () => {
          const { compoundingStakingSSVStrategy } = fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy.verifyBalances(
            balancesProof.firstDepositValidatorBlockTimestamp,
            balancesProof.firstPendingDeposit,
            {
              ...balancesProof.balanceProofs,
              validatorBalanceLeaves: [
                balancesProof.balanceProofs.validatorBalanceLeaves[0],
                balancesProof.balanceProofs.validatorBalanceLeaves[1],
              ],
              // Only one when there is two active validators
              validatorBalanceProofs: [
                balancesProof.balanceProofs.validatorBalanceProofs[0],
              ],
            }
          );

          await expect(tx).to.be.revertedWith("Invalid balance proofs");
        });
        it("Fail to verify balances with too many proofs", async () => {
          const { compoundingStakingSSVStrategy } = fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy.verifyBalances(
            balancesProof.firstDepositValidatorBlockTimestamp,
            balancesProof.firstPendingDeposit,
            {
              ...balancesProof.balanceProofs,
              validatorBalanceLeaves: [
                balancesProof.balanceProofs.validatorBalanceLeaves[0],
                balancesProof.balanceProofs.validatorBalanceLeaves[1],
              ],
              // Three when there is two active validators
              validatorBalanceProofs:
                balancesProof.balanceProofs.validatorBalanceProofs,
            }
          );

          await expect(tx).to.be.revertedWith("Invalid balance proofs");
        });
      });
    });
    describe("With 21 active validators", () => {
      const testValidatorCount = 21;
      const testValidatorProofs = [...Array(testValidatorCount).keys()];
      beforeEach(async () => {
        // register, stake, verify validator and verify deposit
        for (let i = 0; i < testValidatorCount; i++) {
          log(
            `Processing testValidators[${i}] with index ${testValidators[i].index}`
          );
          expect(hashPubKey(testValidators[i].publicKey)).to.equal(
            testValidators[i].publicKeyHash,
            `testValidators[${i}] public key hash mismatch with validator index ${testValidators[i].index}`
          );
          await processValidator(testValidators[i], "VERIFIED_DEPOSIT");
          // Top up the validator to ensure it has enough balance
          await topUpValidator(
            testValidators[i],
            testValidators[i].depositProof.depositAmount - 1,
            "VERIFIED_DEPOSIT"
          );
        }
      });
      it("Should verify balances with some WETH, ETH and no deposits", async () => {
        const { compoundingStakingStrategyView } = fixture;

        const activeValidators =
          await compoundingStakingStrategyView.getVerifiedValidators();
        log(
          `Active validators: ${activeValidators.map((v) => v.index).join(",")}`
        );

        await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 123.456,
          ethAmount: 0.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: testValidatorProofs,
        });
      });
      it("Should verify balances with one validator exited with two pending deposits", async () => {
        const { compoundingStakingSSVStrategy } = fixture;

        const nextDepositID =
          await compoundingStakingSSVStrategy.nextDepositID();

        // Add two deposits to the fourth validator (index 3) that has a zero balance
        // These deposits should be deleted
        await topUpValidator(testValidators[3], 1, "STAKED");
        await topUpValidator(testValidators[3], 2, "STAKED");

        const { tx } = await assertBalances({
          pendingDepositAmount: 0,
          wethAmount: 123.456,
          ethAmount: 0.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: testValidatorProofs,
        });

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositValidatorExited")
          .withArgs(nextDepositID, parseEther("1"));
        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositValidatorExited")
          .withArgs(nextDepositID.add(1), parseEther("2"));
      });
      it("Should verify balances with one validator exited with two pending deposits and three deposits to non-exiting validators", async () => {
        const { compoundingStakingSSVStrategy } = fixture;

        // Add two deposits to the first validator (index 0) that has a balance
        // These deposits should be kept
        await topUpValidator(testValidators[0], 2, "STAKED");
        await topUpValidator(testValidators[0], 3, "STAKED");
        // Add another deposit to the second validator (index 1) that has a balance
        await topUpValidator(testValidators[1], 4, "STAKED");

        const nextDepositID =
          await compoundingStakingSSVStrategy.nextDepositID();

        // Add two deposits to the fourth validator (index 3) that has a zero balance
        // These deposits should be deleted
        await topUpValidator(testValidators[3], 5, "STAKED");
        await topUpValidator(testValidators[3], 6, "STAKED");

        const { tx } = await assertBalances({
          pendingDepositAmount: 9, // 2 + 3 + 4
          wethAmount: 123.456,
          ethAmount: 0.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: testValidatorProofs,
        });

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositValidatorExited")
          .withArgs(nextDepositID, parseEther("5"));
        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositValidatorExited")
          .withArgs(nextDepositID.add(1), parseEther("6"));
      });
    });
  });

  describe("Compounding SSV Staking Strategy Mocked proofs", function () {
    beforeEach(async () => {
      fixture = await loadFixtureMockedProofs();
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

    it("Should be allowed 2 deposits to an exiting validator ", async () => {
      const {
        compoundingStakingSSVStrategy,
        compoundingStakingStrategyView,
        mockBeaconProof,
      } = fixture;
      const testValidator = testValidators[3];

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");

      await topUpValidator(
        testValidator,
        testValidator.depositProof.depositAmount - 1,
        "STAKED"
      );
      const { depositSlot, depositID } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

      await topUpValidator(
        testValidator,
        testValidator.depositProof.depositAmount - 1,
        "STAKED"
      );
      const { depositSlot: depositSlot1, depositID: depositID1 } =
        await getLastDeposit(compoundingStakingSSVStrategy);

      const lastBlock = await ethers.provider.getBlock("latest");
      const epochTime = 12 * 32;

      // 2 epochs from now
      const nextNextEpoch = calcEpoch(
        lastBlock.timestamp + epochTime * 2
      ).toString();

      // simulate validator slashed from the beacon chain
      testValidator.depositProof.strategyValidator.withdrawableEpoch =
        nextNextEpoch;

      await compoundingStakingSSVStrategy.verifyDeposit(
        depositID,
        depositSlot + 1000n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await compoundingStakingSSVStrategy.verifyDeposit(
        depositID1,
        depositSlot1 + 1000n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      const depositData1 = await compoundingStakingSSVStrategy.deposits(
        depositID
      );
      const depositData2 = await compoundingStakingSSVStrategy.deposits(
        depositID1
      );

      await expect(depositData1.withdrawableEpoch).to.equal(nextNextEpoch);
      await expect(depositData2.withdrawableEpoch).to.equal(nextNextEpoch);
      await expect(depositData1.status).to.equal(1); // PENDING
      await expect(depositData2.status).to.equal(1); // PENDING

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
      ).to.equal(4); // EXITING

      await advanceTime(epochTime * 4);

      // simulate validator has exited and been swept by the beacon chain sweeping process
      await mockBeaconProof.setValidatorBalance(testValidator.index, 0);

      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[5],
        activeValidators: [3],
      });

      // verify that the deposits have been removed as the validator has simulated
      // to been fully exited
      const deposits =
        await compoundingStakingStrategyView.getPendingDeposits();
      expect(deposits.length).to.equal(0);

      // Deposit status remains pending even though the validator has exited
      await expect(depositData1.status).to.equal(1); // PENDING
      await expect(depositData2.status).to.equal(1); // PENDING
    });

    it("Should verify validator that has a front-run deposit", async () => {
      const { compoundingStakingSSVStrategy, compoundingStakingStrategyView } =
        fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      const nextDepositID = await compoundingStakingSSVStrategy.nextDepositID();

      await processValidator(testValidator, "STAKED");

      const lastVerifiedEthBalanceBefore =
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance();

      // Verify the the invalid validator
      const attackerAddress = Wallet.createRandom().address;

      const tx = await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        attackerAddress,
        "0x" // empty proof as it is not verified in the mock
      );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "ValidatorInvalid")
        .withArgs(testValidator.publicKeyHash);

      // Validator is invalid
      const { state: validatorStateAfter } =
        await compoundingStakingSSVStrategy.validator(
          testValidator.publicKeyHash
        );
      expect(validatorStateAfter).to.equal(7); // INVALID

      // There are no pending deposits
      const pendingDeposits =
        await compoundingStakingStrategyView.getPendingDeposits();
      expect(pendingDeposits).to.have.lengthOf(0);

      // The deposit status is VERIFIED
      const depositData = await compoundingStakingSSVStrategy.deposits(
        nextDepositID
      );
      expect(depositData.status).to.equal(2); // VERIFIED

      // The last verified ETH balance is reduced by the 1 ETH deposit
      expect(
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance()
      ).to.equal(lastVerifiedEthBalanceBefore.sub(parseEther("1")));

      // The first deposit flag is still set
      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);
    });

    it("Should fail to verify front-run deposit", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      const nextDepositID = await compoundingStakingSSVStrategy.nextDepositID();

      await processValidator(testValidator, "STAKED");

      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);

      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        Wallet.createRandom().address,
        "0x" // empty proof as it is not verified in the mock
      );

      const currentBlock = await ethers.provider.getBlock();
      const depositSlot = calcSlot(currentBlock.timestamp);
      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = depositSlot + 100n;

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        nextDepositID,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );
      await expect(tx).to.be.revertedWith("Deposit not pending");
    });

    it("Governor should reset first deposit after front-run deposit", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");

      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);

      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        Wallet.createRandom().address,
        "0x" // empty proof as it is not verified in the mock
      );

      const tx = await compoundingStakingSSVStrategy
        .connect(governor)
        .resetFirstDeposit();

      await expect(tx).to.emit(
        compoundingStakingSSVStrategy,
        "FirstDepositReset"
      );

      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(
        false
      );
    });

    it("Should verify deposit to an exiting validator from a slashing", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "VERIFIED_DEPOSIT");
      await topUpValidator(
        testValidator,
        testValidator.depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      const nextDepositID = await compoundingStakingSSVStrategy.nextDepositID();

      const depositAmount = 3;
      await topUpValidator(testValidator, depositAmount, "STAKED");

      const currentBlock = await ethers.provider.getBlock();
      const depositSlot = calcSlot(currentBlock.timestamp);
      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = Number(depositSlot + 100n);

      // Simulate the validator has been slashed and is exiting
      const withdrawableEpoch = calcEpoch(currentBlock.timestamp) + 4n;

      const tx = await compoundingStakingSSVStrategy.verifyDeposit(
        nextDepositID,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        {
          ...testValidator.depositProof.strategyValidator,
          withdrawableEpoch,
        }
      );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "DepositToValidatorExiting")
        .withArgs(
          nextDepositID,
          parseEther(depositAmount.toString()),
          withdrawableEpoch
        );

      // The deposit is still PENDING and the withdrawable epoch is set
      const depositAfter = await compoundingStakingSSVStrategy.deposits(
        nextDepositID
      );
      expect(depositAfter.status).to.equal(1); // PENDING
      expect(depositAfter.withdrawableEpoch).to.equal(withdrawableEpoch);

      // The validator is in EXITING state
      const { state: validatorStateAfter } =
        await compoundingStakingSSVStrategy.validator(
          testValidator.publicKeyHash
        );
      expect(validatorStateAfter).to.equal(4); // EXITING
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
