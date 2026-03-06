const { expect } = require("chai");
const { network } = require("hardhat");
const { BigNumber, Wallet } = require("ethers");
const { parseEther, parseUnits, keccak256, hexZeroPad, solidityPack } =
  require("ethers").utils;
const {
  getStorageAt,
  setBalance,
  setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256, ZERO_BYTES32 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const { ethUnits, advanceTime } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { zero } = require("../../utils/addresses");
const { calcDepositRoot } = require("../../tasks/beaconTesting");
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
const emptyOneBalanceProofs = {
  balancesContainerRoot: ZERO_BYTES32,
  balancesContainerProof: "0x",
  validatorBalanceLeaves: [ZERO_BYTES32],
  validatorBalanceProofs: ["0x"],
};
const emptyPendingDepositProofs = {
  pendingDepositContainerRoot: ZERO_BYTES32,
  pendingDepositContainerProof: "0x",
  pendingDepositIndexes: [],
  pendingDepositProofs: [],
};
const emptyOnePendingDepositProofs = {
  pendingDepositContainerRoot: ZERO_BYTES32,
  pendingDepositContainerProof: "0x",
  pendingDepositIndexes: [0],
  pendingDepositProofs: ["0x"],
};
const emptyTwoPendingDepositProofs = {
  pendingDepositContainerRoot: ZERO_BYTES32,
  pendingDepositContainerProof: "0x",
  pendingDepositIndexes: [1, 2],
  pendingDepositProofs: ["0x", "0x"],
};
const emptyPendingDepositsProof = {
  beaconRoot:
    "0x936a7ac91224df0522e8fc70521b604b025d37504a432ca9ea842a018ba7546c",
  proof:
    "0x0000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4bdb56114e00fdd4c1f85c892bf35ac9a89289aaecb1ebd0a96cde606a748b5d71c78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c9efde052aa15429fae05bad4d0b1d7c64da64d03d7a1854a588c2cb8430c0d30d88ddfeed400a8755596b21942c1497e114c302e6118290f91e6772976041fa187eb0ddba57e35f6d286673802a4af5975e22506c7cf4c64bb6be5ee11527f2c26846476fd5fc54a5d43385167c95144f2643f533cc85bb9d16b782f8d7db193506d86582d252405b840018792cad2bf1259f1ef5aa5f887e13cb2f0094f51e1ffff0ad7e659772f9534c195c815efc4014ef1e1daed4404c06385d11192e92b6cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220b7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5fdf6af5f5bbdb6be9ef8aa618e4bf8073960867171e29676f8b284dea6a08a85eb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467650000000000000000000000000000000000000000000000000000000000000000049c9edd0970b512318fe4a7d9ff12b2b1402164d872e40948fc7d9042ae6fa615433386cfe4fc95585fb6eeb51df3a6f619db3b3955884f7e5a2c4600ed2d47dae6d9c51743d5d9263bf2bd09c1db3bd529965d7ee7857643c919c6b696004ec78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123ceb818784738117ef339dce506dc4996cecd38ef7ed6021eb0b4382bf9c3e81b3cce9d380b4759b9c6277871c289b42feed13f46b29b78c3be52296492ef902aecd1fa730ef94dfb6efa48a62de660970894608c2e16cce90ef2b3880778f8e383e09791016e57e609c54db8d85e1e0607a528e23b6c34dc738f899f2c284d765",
};

const getWithdrawalCredentials = (type, address) => {
  return type + "0000000000000000000000" + address.slice(2);
};

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
    it("Should not set platform token", async () => {
      const { compoundingStakingSSVStrategy, governor, weth } = fixture;

      const tx = compoundingStakingSSVStrategy
        .connect(governor)
        .setPTokenAddress(weth.address, weth.address);

      await expect(tx).to.revertedWith("Unsupported function");
    });
    it("Should not remove platform token", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      const tx = compoundingStakingSSVStrategy
        .connect(governor)
        .removePToken(0);

      await expect(tx).to.revertedWith("Unsupported function");
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
    it("Registrator or governor should be the only ones to pause the strategy", async () => {
      const {
        compoundingStakingSSVStrategy,
        governor,
        validatorRegistrator,
        josh,
      } = fixture;

      await compoundingStakingSSVStrategy.connect(governor).pause();
      await compoundingStakingSSVStrategy.connect(governor).unPause();
      await compoundingStakingSSVStrategy.connect(validatorRegistrator).pause();
      await compoundingStakingSSVStrategy.connect(governor).unPause();

      await expect(
        compoundingStakingSSVStrategy.connect(josh).pause()
      ).to.be.revertedWith("Not Registrator or Governor");
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
    const { pendingDepositRoot, depositSlot } = await getLastDeposit(
      compoundingStakingSSVStrategy
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
        getWithdrawalCredentials("0x02", compoundingStakingSSVStrategy.address),
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
      pendingDepositRoot,
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
    const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

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

    const verifiedDepositTx = await verifyDeposit(testValidator);

    if (state === "VERIFIED_DEPOSIT") return verifiedDepositTx;

    throw Error(`Invalid state: ${state}`);
  };

  const verifyDeposit = async (testValidator) => {
    const { beaconRoots, compoundingStakingSSVStrategy } = fixture;

    const { pendingDepositRoot, depositSlot } = await getLastDeposit(
      compoundingStakingSSVStrategy
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

    const verifiedDepositTx = await compoundingStakingSSVStrategy.verifyDeposit(
      pendingDepositRoot,
      depositProcessedSlot,
      testValidator.depositProof.firstPendingDeposit,
      testValidator.depositProof.strategyValidator
    );

    return verifiedDepositTx;
  };

  // call right after depositing to the strategy
  const getLastDeposit = async (compoundingStakingSSVStrategy) => {
    const lastBlock = await ethers.provider.getBlock("latest");
    // roughly the deposit slot
    const depositSlot = calcSlot(lastBlock.timestamp);

    const pendingDepositRoot = await compoundingStakingSSVStrategy.depositList(
      (await compoundingStakingSSVStrategy.depositListLength()).sub(1)
    );

    return {
      depositSlot,
      pendingDepositRoot,
    };
  };

  const snapBalances = async (beaconBlockRoot) => {
    const { compoundingStakingSSVStrategy, beaconRoots, validatorRegistrator } =
      fixture;

    if (!beaconBlockRoot) {
      beaconBlockRoot = "0x" + randomBytes(32).toString("hex");
      log(`Generated random beacon block root: ${beaconBlockRoot}`);
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
    hackDeposits = true,
  }) => {
    const {
      compoundingStakingSSVStrategy,
      compoundingStakingStrategyView,
      validatorRegistrator,
      weth,
    } = fixture;

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

    const filteredBalanceLeaves =
      balancesProof.balanceProofs.validatorBalanceLeaves.filter((_, index) =>
        activeValidators.includes(index)
      );
    const filteredBalanceProofs =
      balancesProof.balanceProofs.validatorBalanceProofs.filter((_, index) =>
        activeValidators.includes(index)
      );
    const filteredBalances = balancesProof.validatorBalances.filter(
      (_, index) => activeValidators.includes(index)
    );

    const deposits = await compoundingStakingStrategyView.getPendingDeposits();

    const pendingDepositIndexes =
      balancesProof.pendingDepositProofsData.pendingDepositIndexes.slice(
        0,
        deposits.length
      );
    const pendingDepositProofs =
      balancesProof.pendingDepositProofsData.pendingDepositProofs.slice(
        0,
        deposits.length
      );

    if (hackDeposits) {
      // hack the pendingDepositRoots in the strategy's depositList array
      for (let i = 0; i < deposits.length; i++) {
        await hackDepositList(
          i,
          balancesProof.pendingDepositProofsData.pendingDepositRoots[i],
          deposits[i]
        );
      }
    }

    const balanceProofsData = {
      ...balancesProof.balanceProofs,
      validatorBalanceLeaves: filteredBalanceLeaves,
      validatorBalanceProofs: filteredBalanceProofs,
    };
    const pendingDepositProofsData = {
      pendingDepositContainerRoot:
        balancesProof.pendingDepositProofsData.pendingDepositContainerRoot,
      pendingDepositContainerProof:
        balancesProof.pendingDepositProofsData.pendingDepositContainerProof,
      pendingDepositIndexes,
      pendingDepositProofs,
    };

    // Verify balances with pending deposits and active validators
    const tx = await compoundingStakingSSVStrategy
      .connect(validatorRegistrator)
      .verifyBalances(balanceProofsData, pendingDepositProofsData);

    // Do not restore the pendingDepositRoots as they can be removed in verifyBalances
    // for (let i = 0; i < deposits.length; i++) {
    //   await hackDepositList(i, deposits[i].pendingDepositRoot, deposits[i]);
    // }

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

  const hackDepositList = async (
    depositIndex,
    newPendingDepositRoot,
    oldDeposit
  ) => {
    const { compoundingStakingSSVStrategy } = fixture;

    // Calculate the storage slot for the deposit in the depositList array
    const depositListSlot = 53;
    const hexStringOf32Bytes = hexZeroPad(
      BigNumber.from(depositListSlot).toHexString(),
      32
    );
    const storageSlot = BigNumber.from(keccak256(hexStringOf32Bytes))
      .add(depositIndex)
      .toHexString();

    // Set the pending deposit root in the deposit list
    await setStorageAt(
      compoundingStakingSSVStrategy.address,
      storageSlot,
      newPendingDepositRoot
    );

    expect(
      await compoundingStakingSSVStrategy.depositList(depositIndex)
    ).to.equal(newPendingDepositRoot);

    // Slot 52 (base slot for mapping)
    const baseMappingSlot = 52n;

    const oldMappingSlot = keccak256(
      solidityPack(
        ["bytes32", "uint256"],
        [oldDeposit.pendingDepositRoot, baseMappingSlot]
      )
    );
    const depositSlot0 = await getStorageAt(
      compoundingStakingSSVStrategy.address,
      oldMappingSlot
    );
    const depositSlot1 = await getStorageAt(
      compoundingStakingSSVStrategy.address,
      BigNumber.from(oldMappingSlot).add(1).toHexString()
    );
    log(`Old deposit data:`);
    log(`  Slot 0: ${depositSlot0}`);
    log(`  Slot 1: ${depositSlot1}`);

    // Compute deposits mapping slot: keccak256(key . baseSlot)
    const newMappingSlot = keccak256(
      solidityPack(
        ["bytes32", "uint256"],
        [newPendingDepositRoot, baseMappingSlot]
      )
    );

    // Set the deposit data
    await setStorageAt(
      compoundingStakingSSVStrategy.address,
      newMappingSlot,
      depositSlot0
    );
    await setStorageAt(
      compoundingStakingSSVStrategy.address,
      BigNumber.from(newMappingSlot).add(1).toHexString(),
      depositSlot1
    );

    const newDeposit = await compoundingStakingSSVStrategy.deposits(
      newPendingDepositRoot
    );
    expect(newDeposit.pubKeyHash).to.equal(oldDeposit.pubKeyHash);
    expect(newDeposit.amountGwei).to.equal(oldDeposit.amountGwei);
    expect(newDeposit.slot).to.equal(oldDeposit.slot);
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

      const ethAmount = ethUnits("2");
      // Register a new validator with the SSV Network
      const regTx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          emptyCluster,
          { value: ethAmount }
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
        .withNamedArgs({
          pubKeyHash: testValidator.publicKeyHash,
          pubKey: testValidator.publicKey,
          amountWei: amountGwei.mul(GweiInWei), // Convert Gwei to Wei
        });

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidator.publicKeyHash
          )
        ).state
      ).to.equal(2, "Validator state not 2 (STAKED)");
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

      const stratBalanceBefore =
        await compoundingStakingSSVStrategy.checkBalance(weth.address);

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          emptyCluster,
          { value: ethUnits("2") }
        );

      const depositDataRoot = await calcDepositRoot(
        compoundingStakingSSVStrategy.address,
        "0x02",
        testValidator.publicKey,
        testValidator.signature,
        1
      );

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
      const { pendingDepositRoot, depositSlot } = await getLastDeposit(
        compoundingStakingSSVStrategy
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
        getWithdrawalCredentials("0x02", compoundingStakingSSVStrategy.address),
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
        pendingDepositRoot,
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

      stakeTx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: depositDataRoot2,
          },
          BigNumber.from(secondDepositAmount.toString()).mul(GweiInWei)
        );

      const { pendingDepositRoot: pendingDepositRoot2 } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

      await expect(stakeTx)
        .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
        .withArgs(
          testValidator.publicKeyHash,
          pendingDepositRoot2,
          testValidator.publicKey,
          parseEther(secondDepositAmount.toString())
        );

      // Cheating here by using the same proof as before
      // it works as the deposit block is after the second deposit on the execution layer
      await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot2,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      expect(
        await compoundingStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(stratBalanceBefore);
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
          emptyCluster,
          { value: ethUnits("2") }
        );

      // Try to stake 2 ETH to the new validator
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

    it("Should revert registerSsvValidator when contract paused", async () => {
      const { compoundingStakingSSVStrategy, governor, validatorRegistrator } =
        fixture;
      const testValidator = testValidators[0];

      await compoundingStakingSSVStrategy.connect(governor).pause();
      // Register a new validator with the SSV Network
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          emptyCluster,
          { value: ethUnits("2") }
        );

      await expect(tx).to.be.revertedWith("Pausable: paused");
    });

    it("Should revert stakeEth when contract paused", async () => {
      const { compoundingStakingSSVStrategy, governor, validatorRegistrator } =
        fixture;
      const testValidator = testValidators[0];

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          emptyCluster,
          { value: ethUnits("2") }
        );

      await compoundingStakingSSVStrategy.connect(governor).pause();

      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositProof.depositDataRoot,
          },
          GweiInWei
        );

      await expect(tx).to.be.revertedWith("Pausable: paused");
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
          emptyCluster,
          { value: ethUnits("2") }
        );

      // Try to register the same validator again
      await expect(
        compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .registerSsvValidator(
            testValidator.publicKey,
            testValidator.operatorIds,
            testValidator.sharesData,
            emptyCluster,
            { value: ethUnits("2") }
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

      const validatorBefore = await compoundingStakingSSVStrategy.validator(
        testValidators[3].publicKeyHash
      );
      expect(validatorBefore.state).to.equal(3); // VERIFIED

      // Validator has 1588.918094377 ETH
      // assert balances so validator can be fully withdrawable
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      const validatorAfter = await compoundingStakingSSVStrategy.validator(
        testValidators[3].publicKeyHash
      );
      expect(validatorAfter.state).to.equal(4); // ACTIVE

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
      ).to.equal(5); // EXITING
    });

    it("Should exit a validator that is already exiting", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      const validatorBefore = await compoundingStakingSSVStrategy.validator(
        testValidators[3].publicKeyHash
      );
      expect(validatorBefore.state).to.equal(3); // VERIFIED

      // Validator has 1588.918094377 ETH
      // assert balances so validator can be fully withdrawable
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      const validatorAfter = await compoundingStakingSSVStrategy.validator(
        testValidators[3].publicKeyHash
      );
      expect(validatorAfter.state).to.equal(4); // ACTIVE

      // First exit
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, {
          value: 1,
        });

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidators[3].publicKeyHash
          )
        ).state
      ).to.equal(5); // EXITING

      // Second exit
      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, {
          value: 1,
        });

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "ValidatorWithdraw")
        .withArgs(testValidators[3].publicKeyHash, 0);
    });

    it("Should revert when validator's balance hasn't been confirmed to equal or surpass 32.25 ETH", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topUpValidator(testValidators[3], 32, "VERIFIED_DEPOSIT");

      // verifyBalances has not been called so the validator is still VERIFIED even though the
      // validator has more then 32.25 ETH staked

      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, {
          value: 1,
        });

      await expect(tx).to.be.revertedWith("Validator not active/exiting");
    });

    it("Should revert partial withdrawal when validator's balance hasn't been confirmed to equal or surpass 32 ETH", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 1, {
          value: 1,
        });

      await expect(tx).to.be.revertedWith("Validator not active/exiting");
    });

    it("Should revert when exiting a validator with a pending deposit", async () => {
      const { validatorRegistrator, compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      await processValidator(testValidators[3], "VERIFIED_DEPOSIT");
      // Stake but do not verify the deposit
      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "VERIFIED_DEPOSIT"
      );

      // Validator has 1588.918094377 ETH
      // assert balances so validator can be fully withdrawable
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      await topUpValidator(testValidators[3], 1, "STAKED");

      // Amount 0 is a full validator exit
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .validatorWithdrawal(testValidators[3].publicKey, 0, { value: 1 });

      await expect(tx).to.be.revertedWith("Pending deposit");
    });

    it("Should revert when verifying deposit between snapBalances and verifyBalances", async () => {
      const {
        beaconRoots,
        compoundingStakingSSVStrategy,
        validatorRegistrator,
      } = fixture;
      const testValidator = testValidators[3];

      // Third validator is later withdrawn later
      await processValidator(testValidator, "VERIFIED_VALIDATOR");
      const { pendingDepositRoot, depositSlot } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

      // Snap balances before the deposit is processed
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = depositSlot + 10000n;

      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      const verifiedDepositTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .verifyDeposit(
          pendingDepositRoot,
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
        "VERIFIED_DEPOSIT"
      );

      // Validator has 1588.918094377 ETH
      // assert balances so validator can be fully withdrawable
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[1],
        activeValidators: [2],
      });

      await topUpValidator(testValidators[3], 1, "STAKED");

      expect(
        (
          await compoundingStakingSSVStrategy.validator(
            testValidators[3].publicKeyHash
          )
        ).state
      ).to.equal(4); // ACTIVE

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
      ).to.equal(4); // ACTIVE
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
          emptyCluster,
          { value: ethUnits("2") }
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
      const {
        validatorRegistrator,
        compoundingStakingSSVStrategy,
        compoundingStakingStrategyView,
      } = fixture;

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

      await expect(
        (
          await compoundingStakingStrategyView.getVerifiedValidators()
        ).length
      ).to.equal(1);

      // Verify the validator with a zero balance which marks the validator as exited
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[2],
        activeValidators: [2],
      });

      await expect(
        (
          await compoundingStakingStrategyView.getVerifiedValidators()
        ).length
      ).to.equal(0);

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

    it("Should not remove a validator if it still has a pending deposit", async () => {
      const { compoundingStakingStrategyView } = fixture;
      const epochTime = 12 * 32;

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

      await expect(
        (
          await compoundingStakingStrategyView.getVerifiedValidators()
        ).length
      ).to.equal(1);

      // need to advance to a new slot so there are no duplicate deposits
      await advanceTime(epochTime * 4);

      await topUpValidator(
        testValidators[3],
        testValidators[3].depositProof.depositAmount - 1,
        "STAKED"
      );

      // Verify the validator with a zero balance doesn't mark the validator as exited
      // because it still has one pending deposit
      await assertBalances({
        pendingDepositAmount: 50.497526,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[2],
        activeValidators: [2],
      });

      await expect(
        (
          await compoundingStakingStrategyView.getVerifiedValidators()
        ).length
      ).to.equal(1);

      // deposit to on beacon chain exited validator can still be verified
      await verifyDeposit(testValidators[3]);

      // and another snap/verify balances will exit that validator
      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: testBalancesProofs[2],
        activeValidators: [2],
      });

      // which means no more active validators
      await expect(
        (
          await compoundingStakingStrategyView.getVerifiedValidators()
        ).length
      ).to.equal(0);
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

    it("Should fail removing a strategy with funds", async () => {
      const { compoundingStakingSSVStrategy, oethVault, governor } = fixture;

      await stakeValidators(0, 1);
      if (
        (await oethVault.defaultStrategy()) ===
        compoundingStakingSSVStrategy.address
      ) {
        await oethVault.connect(governor).setDefaultStrategy(zero);
      }

      await expect(
        oethVault
          .connect(governor)
          .removeStrategy(compoundingStakingSSVStrategy.address)
      ).to.be.revertedWith("Strategy has funds");
    });
  });

  describe("Verify deposits", () => {
    const testValidator = testValidators[1];
    let pendingDepositRoot;
    let depositSlot;
    beforeEach(async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // register, stake and verify validator
      await processValidator(testValidator, "VERIFIED_VALIDATOR");
      const lastDeposit = await getLastDeposit(compoundingStakingSSVStrategy);
      pendingDepositRoot = lastDeposit.pendingDepositRoot;
      depositSlot = lastDeposit.depositSlot;
    });
    it("Should revert first pending deposit slot is zero", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositSlot + 100n,
        { ...testValidator.depositProof.firstPendingDeposit, slot: 0 },
        testValidator.depositProof.strategyValidator
      );

      await expect(tx).to.be.revertedWith("Zero 1st pending deposit slot");
    });
    it("Should revert when no deposit", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      const invalidPendingDepositRoot = "0x" + randomBytes(32).toString("hex");

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        invalidPendingDepositRoot,
        depositSlot + 100n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx).to.be.revertedWith("Deposit not pending");
    });
    it("Should revert when deposit verified again", async () => {
      const { beaconRoots, compoundingStakingSSVStrategy } = fixture;

      const depositProcessedSlot = depositSlot + 100n;
      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot + 1n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx).to.be.revertedWith("Deposit not pending");
    });
    it("Should revert when processed slot is after snapped balances", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      // Make sure we are at the next slot by moving time forward 12 seconds
      await advanceTime(12);
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      const currentBlock = await ethers.provider.getBlock("latest");
      const currentSlot = calcSlot(BigInt(currentBlock.timestamp));
      const depositProcessedSlot = currentSlot;

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx).to.be.revertedWith("Deposit after balance snapshot");
    });
    it("Should verify deposit with no snapped balances", async () => {
      const { beaconRoots, compoundingStakingSSVStrategy } = fixture;

      const depositProcessedSlot = depositSlot + 1n;
      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      const tx = await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
        .withArgs(pendingDepositRoot, parseEther("1"));
    });
    it("Should verify deposit with processed slot 1 before the snapped balances slot", async () => {
      const {
        beaconRoots,
        compoundingStakingSSVStrategy,
        validatorRegistrator,
      } = fixture;

      // Move two slots ahead so depositProcessedSlot is after the snap
      await advanceTime(24);

      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      const { timestamp: snappedTimestamp } =
        await compoundingStakingSSVStrategy.snappedBalance();
      const depositProcessedSlot = calcSlot(BigInt(snappedTimestamp)) - 1n;

      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      const tx = await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
        .withArgs(pendingDepositRoot, parseEther("1"));
    });
    it("Should verify deposit with processed slot well before the snapped balances slot", async () => {
      const {
        beaconRoots,
        compoundingStakingSSVStrategy,
        validatorRegistrator,
      } = fixture;

      // Move 10 slots ahead of the deposit slot
      await advanceTime(120);
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      const depositProcessedSlot = depositSlot + 1n;

      await beaconRoots["setBeaconRoot(uint256,bytes32)"](
        calcBlockTimestamp(depositProcessedSlot) + 12n,
        testValidator.depositProof.processedBeaconBlockRoot
      );

      const tx = await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
        depositProcessedSlot,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
        .withArgs(pendingDepositRoot, parseEther("1"));
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
      const { compoundingStakingSSVStrategy, weth, josh, oethVault } = fixture;

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
        .withdraw(oethVault.address, weth.address, depositAmount);

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
      const {
        compoundingStakingSSVStrategy,
        weth,
        josh,
        oethVault,
        validatorRegistrator,
      } = fixture;

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
        .connect(validatorRegistrator)
        .withdraw(
          oethVault.address,
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
      ).to.be.revertedWith("Recipient not Vault");
    });

    it("Should revert when withdrawing to a user", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(sVault)
          .withdraw(josh.address, weth.address, parseEther("10"))
      ).to.be.revertedWith("Recipient not Vault");
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
      const verifyBalancesNoDepositsOrValidators = async () => {
        const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

        const tx = await compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .verifyBalances(
            {
              balancesContainerRoot: ZERO_BYTES32,
              balancesContainerProof: "0x",
              validatorBalanceLeaves: [],
              validatorBalanceProofs: [],
            },
            emptyPendingDepositProofs
          );

        return tx;
      };
      it("Should verify balances with no WETH", async () => {
        const { compoundingStakingSSVStrategy, weth } = fixture;

        const { timestamp } = await snapBalances();

        const tx = await verifyBalancesNoDepositsOrValidators();

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

        const tx = await verifyBalancesNoDepositsOrValidators();

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

        const tx = await verifyBalancesNoDepositsOrValidators();

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

        const tx = await verifyBalancesNoDepositsOrValidators();

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
        await processValidator(testValidators[0], "STAKED");

        const balancesAfter = await assertBalances({
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
      it("Should verify balances with one exited verified validator", async () => {
        // Test validator has index 2018225 has a 32.008954871 balance
        const testValidatorIndex = 4;
        await processValidator(
          testValidators[testValidatorIndex],
          "VERIFIED_VALIDATOR"
        );

        await assertBalances({
          pendingDepositAmount: 1,
          wethAmount: 0,
          ethAmount: 0,
          balancesProof: testBalancesProofs[5],
          activeValidators: [testValidatorIndex],
        });
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
          ).to.equal(4); // ACTIVE

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
          ).to.equal(6); // EXITED
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
        let balancesProof;
        beforeEach(async () => {
          balancesProof = testBalancesProofs[3];
          await snapBalances(balancesProof.blockRoot);
        });
        it("Fail to verify balances with not enough validator leaves", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .verifyBalances(
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
              },
              emptyPendingDepositProofs
            );

          await expect(tx).to.be.revertedWith("Invalid balance leaves");
        });
        it("Fail to verify balances with too many validator leaves", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .verifyBalances(
              {
                ...balancesProof.balanceProofs,
                // Three when there is two active validators
                validatorBalanceLeaves:
                  balancesProof.balanceProofs.validatorBalanceLeaves,
                validatorBalanceProofs: [
                  balancesProof.balanceProofs.validatorBalanceProofs[0],
                  balancesProof.balanceProofs.validatorBalanceProofs[1],
                ],
              },
              emptyPendingDepositProofs
            );

          await expect(tx).to.be.revertedWith("Invalid balance leaves");
        });
        it("Fail to verify balances with not enough validator proofs", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .verifyBalances(
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
              },
              emptyPendingDepositProofs
            );

          await expect(tx).to.be.revertedWith("Invalid balance proofs");
        });
        it("Fail to verify balances with too many proofs", async () => {
          const { compoundingStakingSSVStrategy, validatorRegistrator } =
            fixture;

          // Verify balances with pending deposits and active validators
          const tx = compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .verifyBalances(
              {
                ...balancesProof.balanceProofs,
                validatorBalanceLeaves: [
                  balancesProof.balanceProofs.validatorBalanceLeaves[0],
                  balancesProof.balanceProofs.validatorBalanceLeaves[1],
                ],
                // Three when there is two active validators
                validatorBalanceProofs:
                  balancesProof.balanceProofs.validatorBalanceProofs,
              },
              emptyPendingDepositProofs
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
        // Add two deposits to the fourth validator (index 3) that has a zero balance
        // These deposits should be deleted
        await topUpValidator(testValidators[3], 1, "STAKED");
        await topUpValidator(testValidators[3], 2, "STAKED");

        await assertBalances({
          pendingDepositAmount: 3,
          wethAmount: 123.456,
          ethAmount: 0.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: testValidatorProofs,
        });
      });
      it("Should verify balances with one validator exited with two pending deposits and three deposits to non-exiting validators", async () => {
        // Add two deposits to the first validator (index 0) that has a balance
        // These deposits should be kept
        await topUpValidator(testValidators[0], 2, "STAKED");
        await topUpValidator(testValidators[0], 3, "STAKED");
        // Add another deposit to the second validator (index 1) that has a balance
        await topUpValidator(testValidators[1], 4, "STAKED");

        // Add two deposits to the fourth validator (index 3) that has a zero balance
        await topUpValidator(testValidators[3], 5, "STAKED");
        await topUpValidator(testValidators[3], 6, "STAKED");

        await assertBalances({
          pendingDepositAmount: 20, // 2 + 3 + 4 + 5 + 6
          wethAmount: 123.456,
          ethAmount: 0.345,
          balancesProof: testBalancesProofs[5],
          activeValidators: testValidatorProofs,
        });
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
      // when modifying a json object make a copy
      const testValidator = JSON.parse(JSON.stringify(testValidators[3]));

      // Third validator is later withdrawn later
      await processValidator(testValidator, "VERIFIED_DEPOSIT");

      await topUpValidator(
        testValidator,
        testValidator.depositProof.depositAmount - 1,
        "STAKED"
      );
      const { depositSlot, pendingDepositRoot: pendingDepositRoot1 } =
        await getLastDeposit(compoundingStakingSSVStrategy);

      await topUpValidator(
        testValidator,
        testValidator.depositProof.depositAmount - 2,
        "STAKED"
      );
      const { pendingDepositRoot: pendingDepositRoot2 } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

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
        pendingDepositRoot1,
        depositSlot + 1000n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      await compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot2,
        depositSlot + 1000n,
        testValidator.depositProof.firstPendingDeposit,
        testValidator.depositProof.strategyValidator
      );

      let depositData1 = await compoundingStakingSSVStrategy.deposits(
        pendingDepositRoot1
      );
      let depositData2 = await compoundingStakingSSVStrategy.deposits(
        pendingDepositRoot2
      );

      await expect(depositData1.status).to.equal(2); // VERIFIED
      await expect(depositData2.status).to.equal(2); // VERIFIED

      await advanceTime(epochTime * 4);

      // simulate validator has exited and been swept by the beacon chain sweeping process
      await mockBeaconProof.setValidatorBalance(testValidator.index, 0);

      await assertBalances({
        pendingDepositAmount: 0,
        wethAmount: 0,
        ethAmount: 0,
        balancesProof: {
          balanceProofs: emptyOneBalanceProofs,
          pendingDepositProofsData: emptyTwoPendingDepositProofs,
          validatorBalances: [],
        },
        activeValidators: [0],
        hackDeposits: false,
      });

      // verify that the deposits have been removed as the validator has simulated
      // to been fully exited
      const deposits =
        await compoundingStakingStrategyView.getPendingDeposits();
      expect(deposits.length).to.equal(0);

      depositData1 = await compoundingStakingSSVStrategy.deposits(
        pendingDepositRoot1
      );
      depositData2 = await compoundingStakingSSVStrategy.deposits(
        pendingDepositRoot2
      );

      // Verify that the deposits have been marked as VERIFIED as they
      // were removed
      await expect(depositData1.status).to.equal(2); // VERIFIED
      await expect(depositData2.status).to.equal(2); // VERIFIED
    });

    it("Should verify validator that has a front-run deposit", async () => {
      const { compoundingStakingSSVStrategy, compoundingStakingStrategyView } =
        fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");
      const { pendingDepositRoot } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

      const lastVerifiedEthBalanceBefore =
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance();

      // Verify the the invalid validator
      const attackerAddress = Wallet.createRandom().address;

      const tx = await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        getWithdrawalCredentials("0x02", attackerAddress),
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
      expect(validatorStateAfter).to.equal(8); // INVALID

      // There are no pending deposits
      const pendingDeposits =
        await compoundingStakingStrategyView.getPendingDeposits();
      expect(pendingDeposits).to.have.lengthOf(0);

      // The deposit status is VERIFIED
      const depositData = await compoundingStakingSSVStrategy.deposits(
        pendingDepositRoot
      );
      expect(depositData.status).to.equal(2); // VERIFIED

      // The last verified ETH balance is reduced by the 1 ETH deposit
      expect(
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance()
      ).to.equal(lastVerifiedEthBalanceBefore.sub(parseEther("1")));

      // The first deposit flag is still set
      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);
    });

    it("Should verify validator with incorrect type", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");

      const tx = await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        getWithdrawalCredentials("0x01", compoundingStakingSSVStrategy.address),
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
      expect(validatorStateAfter).to.equal(8); // INVALID
    });

    it("Should verify validator with malformed credentials", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");

      const malformedCredentials =
        "0x020000000bafa00000000000" +
        compoundingStakingSSVStrategy.address.slice(2);

      const tx = await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        malformedCredentials,
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
      expect(validatorStateAfter).to.equal(8); // INVALID
    });

    it("Should fail to verify front-run deposit", async () => {
      const { compoundingStakingSSVStrategy } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");
      const { pendingDepositRoot } = await getLastDeposit(
        compoundingStakingSSVStrategy
      );

      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);

      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        getWithdrawalCredentials("0x02", Wallet.createRandom().address),
        "0x" // empty proof as it is not verified in the mock
      );

      const currentBlock = await ethers.provider.getBlock();
      const depositSlot = calcSlot(currentBlock.timestamp);
      // Set parent beacon root for the block after the verification slots
      const depositProcessedSlot = depositSlot + 100n;

      const tx = compoundingStakingSSVStrategy.verifyDeposit(
        pendingDepositRoot,
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
        getWithdrawalCredentials("0x02", Wallet.createRandom().address),
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

    it("Should remove a validator from SSV cluster when validator is invalid", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "STAKED");

      expect(await compoundingStakingSSVStrategy.firstDeposit()).to.equal(true);

      await compoundingStakingSSVStrategy.verifyValidator(
        testValidator.validatorProof.nextBlockTimestamp,
        testValidator.index,
        testValidator.publicKeyHash,
        getWithdrawalCredentials("0x02", Wallet.createRandom().address),
        "0x" // empty proof as it is not verified in the mock
      );

      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          emptyCluster
        );

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRemoved")
        .withArgs(testValidator.publicKeyHash, testValidator.operatorIds);
    });

    it("Should fail to active a validator with a 32.25 ETH balance", async () => {
      const {
        compoundingStakingSSVStrategy,
        mockBeaconProof,
        validatorRegistrator,
      } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "VERIFIED_DEPOSIT");
      await topUpValidator(testValidator, 31, "VERIFIED_DEPOSIT");

      const validatorBefore = await compoundingStakingSSVStrategy.validator(
        testValidator.publicKeyHash
      );
      expect(validatorBefore.state).to.equal(3); // VERIFIED

      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      // Set validator balance to 32.25 Gwei
      await mockBeaconProof.setValidatorBalance(
        testValidator.index,
        parseUnits("32.25", 9)
      );

      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .verifyBalances(emptyOneBalanceProofs, emptyPendingDepositProofs);

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
        .withNamedArgs({
          totalDepositsWei: 0,
        });

      // The validator should still be VERIFIED, not ACTIVE
      const validatorAfter = await compoundingStakingSSVStrategy.validator(
        testValidator.publicKeyHash
      );
      expect(validatorAfter.state).to.equal(3); // VERIFIED
    });

    it("Should active a validator with more than 32.25 ETH balance", async () => {
      const {
        compoundingStakingSSVStrategy,
        mockBeaconProof,
        validatorRegistrator,
      } = fixture;

      // Third validator is later withdrawn later
      const testValidator = testValidators[3];

      await processValidator(testValidator, "VERIFIED_DEPOSIT");
      await topUpValidator(testValidator, 31, "VERIFIED_DEPOSIT");

      const validatorBefore = await compoundingStakingSSVStrategy.validator(
        testValidator.publicKeyHash
      );
      expect(validatorBefore.state).to.equal(3); // VERIFIED

      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .snapBalances();

      // Set validator balance to 32.26 Gwei
      await mockBeaconProof.setValidatorBalance(
        testValidator.index,
        parseUnits("32.26", 9)
      );

      const tx = await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .verifyBalances(emptyOneBalanceProofs, emptyPendingDepositProofs);

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
        .withNamedArgs({
          totalDepositsWei: 0,
        });

      // The validator should still be ACTIVE
      const validatorAfter = await compoundingStakingSSVStrategy.validator(
        testValidator.publicKeyHash
      );
      expect(validatorAfter.state).to.equal(4); // ACTIVE
    });

    describe("When a verified validator is exiting after being slashed And a new deposit is made to the validator", () => {
      const depositAmount = 3;
      // Validator is later withdrawn later
      const testValidator = testValidators[11];
      let lastDeposit;
      let withdrawableEpoch, withdrawableSlot, withdrawableTimestamp;
      let strategyValidatorData;
      beforeEach(async () => {
        const { compoundingStakingSSVStrategy } = fixture;

        await processValidator(testValidator, "VERIFIED_DEPOSIT");
        await topUpValidator(
          testValidator,
          testValidator.depositProof.depositAmount - 1,
          "VERIFIED_DEPOSIT"
        );

        await topUpValidator(testValidator, depositAmount, "STAKED");

        lastDeposit = await getLastDeposit(compoundingStakingSSVStrategy);

        // Withdrawable epoch is 4 epochs from the current block
        const currentBlock = await ethers.provider.getBlock();
        withdrawableEpoch = calcEpoch(currentBlock.timestamp) + 4n;
        withdrawableSlot = withdrawableEpoch * 32n;
        withdrawableTimestamp = Number(calcBlockTimestamp(withdrawableSlot));

        strategyValidatorData = {
          ...testValidator.depositProof.strategyValidator,
          withdrawableEpoch,
        };
      });
      it("Should fail verify deposit when first pending deposit slot before the withdrawable epoch", async () => {
        const { compoundingStakingSSVStrategy } = fixture;

        const firstPendingDepositSlot = withdrawableSlot - 1n;
        const depositProcessedSlot = withdrawableSlot;
        const firstPendingDeposit = {
          ...testValidator.depositProof.firstPendingDeposit,
          slot: firstPendingDepositSlot,
        };

        const tx = compoundingStakingSSVStrategy.verifyDeposit(
          lastDeposit.pendingDepositRoot,
          depositProcessedSlot,
          firstPendingDeposit,
          strategyValidatorData
        );

        await expect(tx).to.be.revertedWith("Exit Deposit likely not proc.");
      });
      it("Should verify deposit when the pending deposit queue is empty", async () => {
        const {
          compoundingStakingSSVStrategy,
          compoundingStakingStrategyView,
        } = fixture;

        const depositProcessedSlot = withdrawableSlot;
        const firstPendingDeposit = {
          ...emptyPendingDepositsProof,
          slot: 1,
        };

        const tx = await compoundingStakingSSVStrategy.verifyDeposit(
          lastDeposit.pendingDepositRoot,
          depositProcessedSlot,
          firstPendingDeposit,
          strategyValidatorData
        );

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
          .withArgs(
            lastDeposit.pendingDepositRoot,
            parseEther(depositAmount.toString())
          );

        // The deposit is verified
        const depositAfter = await compoundingStakingSSVStrategy.deposits(
          lastDeposit.pendingDepositRoot
        );
        expect(depositAfter.status).to.equal(2); // VERIFIED

        // No pending deposits
        expect(await compoundingStakingStrategyView.getPendingDeposits()).to.be
          .empty;
      });
      it("Should verify deposit when the first pending deposit slot equals the withdrawable epoch", async () => {
        const {
          compoundingStakingSSVStrategy,
          compoundingStakingStrategyView,
        } = fixture;

        const firstPendingDepositSlot = withdrawableSlot;
        const depositProcessedSlot = withdrawableSlot;
        const firstPendingDeposit = {
          ...testValidator.depositProof.firstPendingDeposit,
          slot: firstPendingDepositSlot,
        };

        const tx = await compoundingStakingSSVStrategy.verifyDeposit(
          lastDeposit.pendingDepositRoot,
          depositProcessedSlot,
          firstPendingDeposit,
          strategyValidatorData
        );

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
          .withArgs(
            lastDeposit.pendingDepositRoot,
            parseEther(depositAmount.toString())
          );

        // The deposit is verified
        const depositAfter = await compoundingStakingSSVStrategy.deposits(
          lastDeposit.pendingDepositRoot
        );
        expect(depositAfter.status).to.equal(2); // VERIFIED

        // No pending deposits
        expect(await compoundingStakingStrategyView.getPendingDeposits()).to.be
          .empty;
      });
      it("Should verify deposit when the first pending deposit slot is after the withdrawable epoch", async () => {
        const {
          compoundingStakingSSVStrategy,
          compoundingStakingStrategyView,
        } = fixture;

        const firstPendingDepositSlot = withdrawableSlot + 1n;
        const depositProcessedSlot = firstPendingDepositSlot + 5n;
        const firstPendingDeposit = {
          ...testValidator.depositProof.firstPendingDeposit,
          slot: firstPendingDepositSlot,
        };

        const tx = await compoundingStakingSSVStrategy.verifyDeposit(
          lastDeposit.pendingDepositRoot,
          depositProcessedSlot,
          firstPendingDeposit,
          strategyValidatorData
        );

        await expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "DepositVerified")
          .withArgs(
            lastDeposit.pendingDepositRoot,
            parseEther(depositAmount.toString())
          );

        // The deposit is verified
        const depositAfter = await compoundingStakingSSVStrategy.deposits(
          lastDeposit.pendingDepositRoot
        );
        expect(depositAfter.status).to.equal(2); // VERIFIED

        // No pending deposits
        expect(await compoundingStakingStrategyView.getPendingDeposits()).to.be
          .empty;
      });

      describe("When deposit has been verified to an exiting validator", () => {
        beforeEach(async () => {
          const { compoundingStakingSSVStrategy } = fixture;

          const firstPendingDepositSlot = withdrawableSlot + 1n;
          const depositProcessedSlot = firstPendingDepositSlot + 5n;

          await compoundingStakingSSVStrategy.verifyDeposit(
            lastDeposit.pendingDepositRoot,
            depositProcessedSlot,
            testValidator.depositProof.firstPendingDeposit,
            strategyValidatorData
          );
        });

        it("Should verify balances", async () => {
          const {
            compoundingStakingSSVStrategy,
            mockBeaconProof,
            validatorRegistrator,
          } = fixture;

          const { timestamp: currentTimestamp } =
            await ethers.provider.getBlock();

          // Advance the EVM time to after the withdrawable timestamp
          await advanceTime(withdrawableTimestamp - currentTimestamp + 12);

          const { timestamp: advancedTimestamp } =
            await ethers.provider.getBlock();

          expect(advancedTimestamp).to.greaterThan(withdrawableTimestamp);

          await compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .snapBalances();

          // Set the validator balance to zero
          await mockBeaconProof.setValidatorBalance(
            testValidator.index,
            MAX_UINT256
          );

          const tx = await compoundingStakingSSVStrategy
            .connect(validatorRegistrator)
            .verifyBalances(
              emptyOneBalanceProofs,
              emptyOnePendingDepositProofs
            );

          await expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "BalancesVerified")
            .withNamedArgs({
              totalDepositsWei: 0,
            });
        });
      });
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
