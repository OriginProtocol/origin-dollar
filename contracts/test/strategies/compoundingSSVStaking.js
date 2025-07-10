const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
//const { solidityPack } = require("ethers/lib/utils");

const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const { ethUnits } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { zero } = require("../../utils/addresses");
const crypto = require("crypto");

const {
  createFixtureLoader,
  compoundingStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(compoundingStakingSSVStrategyFixture);

const testValidator = {
  publicKey:
    "0xaba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25",
  operatorIds: [348, 352, 361, 377],
  sharesData:
    "0x859f01c8f609cb5cb91f0c98e9b39b077775f10302d0db0edc4ea65e692c97920d5169f6281845a956404c0ba90b88060b74aa3755347441a5729b90bf30a449fa568e21915d11733c7135602b2a3d1a4dce41218ecb0fdb1788ee7e48a9ebd4b4b34f62deea20e9212ce78040dcad2e6382c2f4d4c8b3515a840e1693574068e26c0d58f17dc47d30efe4393f2660dc988aba6166b67732e8df7d9a69d316f330779b2fa4d14712d3bb60436d912bab4464c7c31ae8d2a966d7829063821fc899cc3ec4a8c7098b042323eb9d9cc4d5e945c6d5e6d4eb1b2484163d4b8cd83eea4cc195a68320f023b4d2405cda5110a2eea2c12b70abd9b6bfb567a7850a95fe073a0485c787744efc8658789b0faaff0d942b3c7b89540f594d007936f23c3e7c79fabfe1e2c49199a3f374198e231ca391909ca05ee3c89a7292207131653f6f2f5f5d638d4789a8029001b93827f6f45ef062c9a9d1360a3aedae00fbb8c34495056bacc98c6cecfc1171c84a1e47f3bc328539dbbcd6c79c2aebf7833c684bd807cc8c4dfd6b660e64aece6adf659a969851cf976dead050e9d14aa9c358326c0c0f0cb747041830e124ec872fcf6f82e7f05024da9e6bad10319ca085a0d1519b04c60738043babc1f5a144655e6a28922c2734701c5c93b845996589b8fd246e1bcd97570951cdbed032eeb9c2ac49ac8aeb2e988b6a5513ddcef9ca9bd592c0bce7d38041b52e69e85cda5fd0b84f905c7212b299cf265ee603add20d6459e0841dd05524e96574eebb46473151ec10a08873f7075e15342852f9f16aeb8305211706632475c39ccd8da33969390d035f8a68324e7adced66a726f80532b425cc82dd52a2edc10989db0167317b472a0016215dae35b4c26b28c0ebcf56e115eb32231449812e9ce866a8c0b3128878d3878f5be0670051a8bf94807123c54e6ea2f51607e32c2fe1b132c905c81965dd6d2a7474aa40b65f18d34084a74ba9a21fbdfba3bfaf6b11175d85f03181d655fda086d8dbe2f03dfa2e1b7140b1d9dc68fc9e22f184ed278599d29f6660af128e4c548de6926912d920e35575db90338a1a840f8d8842685f5b459fda573eaf5c5180e3369fc50faa681941dbe7dec83ee9649f30c1a0eac1f8a42fb3083d9274f4c622e2aa1e74b70fa6c027b4f23e1f80bfc4f69248b4d0b3e0eee9372869f97eb89d8d155e469191c48834ad58dd831f1b73409d71fccb958b6582a4ac3f98bcffff2abd393cbe64d7397ada699ecc75301e3be9e9b4ee92a990202c6a5e5112de5ea9cd666f41cdac4611575c8efe2137d6132cd4d4eea0de159eab44588a88f887e4263f673fb365415df537c77a4aaaee12dceff022eafcb8e6973eec7e18eb65cfeefa845b79754ec52a9270f0a7e570b1dd2171e629d498f34e6371726fa8cfe6863f9263c5222a953a44612944183789ad1020de8da527bf850429558dda7896059476e497284512c946d7a57acda3c3ee722d280c0d0daf758d6be88db48e96e14124832c38aa6d0dd38baeb4f246b01d7b0beb55c3983fb182cbf630b778384cc13ab6216611bc1eab94ffe17bb1e829700c99ec28fae1a87eaefd9c8edc4cdf3b6f2b07d85e0d8090ddfb2df4280dacd13a1f30cf946f5606940dc3f75622159b1c6f84bfdbd4ba9fa0f1d522f52bc2049da53f0d06931d650ef1274eb0247844c36349617095f9734e89be683fd7bd5001b416d800c53ec8e8eb533c418a83e803daf6fdfd552ca745bb2b24d8abe899ea89572524343386a035b675e9d5eeae81aefb3a24397f36fe501c66b27d1c0e453fcc975c888d9d6d5a4ca0a4b32b41deebed70",
  signature:
    "0x90157a1c1b26384f0b4d41bec867d1a000f75e7b634ac7c4c6d8dfc0b0eaeb73bcc99586333d42df98c6b0a8c5ef0d8d071c68991afcd8fbbaa8b423e3632ee4fe0782bc03178a30a8bc6261f64f84a6c833fb96a0f29de1c34ede42c4a859b0",
  depositDataRoot:
    "0xdbe778a625c68446f3cc8b2009753a5e7dd7c37b8721ee98a796bb9179dfe8ac",
};
const testPublicKeys = [
  "0xaba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25",
  "0xa8adaec39a6738b09053a3ed9d44e481d5b2dfafefe0059da48756db951adf4f2956c1149f3bd0634e4cde009a770afb",
  "0xaa8cdeb9efe0cb2f703332a46051214464796e7de7b882abd243c175b2d96250ad227846f713876445f864b2e2f695c1",
  "0xb22b68e2a4f524e96c7818dbfca3de0f7fb4e87449fe8166fd310bea3e3e4295db41b21e65612d1d4bd8a14f2d47e49a",
  "0x92fe1f554b8110fa5c74af8181ca2afaad12f6d22cad933ef1978b5d4d099d75045e4d6d15066c290aee29990858cb90",
  "0xb27b34f6931ba70a11c2ba82f194e9b98093a5a482bb035a836df9aa4b5f57542354da453538b651c18eefc0ea3a7689",
];

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
  let sHarvester;
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
    sHarvester = await impersonateAndFund(
      await compoundingStakingSSVStrategy.harvesterAddress()
    );
    await weth
      .connect(josh)
      .approve(compoundingStakingSSVStrategy.address, MAX_UINT256);
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.compoundingStakingSSVStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    harvester: fixture.oethHarvester,
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

  describe("Initial setup", function () {
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

  describe("Configuring the strategy", function () {
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

    it("Should be able to pause/unpause the strategy", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      const tx = await compoundingStakingSSVStrategy
        .connect(strategist)
        .pause();

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "Paused")
        .withArgs(strategist.address);
    });

    it("Should support WETH as the only asset", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      const assets = await compoundingStakingSSVStrategy.supportsAsset(
        weth.address
      );
      expect(assets).to.equal(true);
    });
  });

  describe("Register and stake validators", async () => {
    beforeEach(async () => {
      const { weth, josh, ssv, compoundingStakingSSVStrategy } = fixture;

      await setERC20TokenBalance(
        compoundingStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, ethUnits("256"));
    });

    const stakeValidatorsSingle = async (
      validators,
      stakeTresholdErrorTriggered,
      startingIndex = 0,
      amount = BigNumber.from("32").mul(ETHInGwei) // In Gwei
    ) => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      // there is a limitation to this function as it will only check for
      // a failure transaction with the last stake call
      for (let i = startingIndex; i < validators; i++) {
        expect(
          await compoundingStakingSSVStrategy.validatorState(
            hashPubKey(testPublicKeys[i])
          )
        ).to.equal(0, "Validator state not 0 (NON_REGISTERED)");

        const ssvAmount = ethUnits("2");
        // Register a new validator with the SSV Network
        const regTx = await compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .registerSsvValidator(
            testPublicKeys[i],
            testValidator.operatorIds,
            testValidator.sharesData,
            ssvAmount,
            emptyCluster
          );

        await expect(regTx)
          .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRegistered")
          .withArgs(hashPubKey(testPublicKeys[i]), testValidator.operatorIds);

        expect(
          await compoundingStakingSSVStrategy.validatorState(
            hashPubKey(testPublicKeys[i])
          )
        ).to.equal(1, "Validator state not 1 (REGISTERED)");

        // Stake ETH to the new validator

        const stakeTx = compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .stakeEth(
            {
              pubkey: testPublicKeys[i],
              signature: testValidator.signature,
              depositDataRoot: testValidator.depositDataRoot,
            },
            amount
          );

        await stakeTx;

        await expect(stakeTx)
          .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
          .withArgs(
            hashPubKey(testPublicKeys[i]),
            testPublicKeys[i],
            amount.mul(GweiInWei) // Convert Gwei to Wei
          );

        expect(
          await compoundingStakingSSVStrategy.validatorState(
            hashPubKey(testPublicKeys[i])
          )
        ).to.equal(2, "Validator state not 2 (STAKED)");
      }
    };

    it("Should stake to a validator: 1 ETH", async () => {
      await stakeValidatorsSingle(1, false, 0, ETHInGwei); // 1e9 Gwei = 1 ETH
    });

    it("Should stake to a validator: 32 ETH", async () => {
      await stakeValidatorsSingle(1, false); // 32e9 Gwei = 32 ETH
    });

    it("Should stake to 2 validators: 1 ETH", async () => {
      await stakeValidatorsSingle(2, false, 0, ETHInGwei);
    });

    it("Should revert when registering a validator that is already registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;
      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testPublicKeys[0],
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
            testPublicKeys[0],
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
      let balance = await weth.balanceOf(compoundingStakingSSVStrategy.address);
      balance = balance.div(GweiInWei); // Convert from Wei to Gwei
      // Stake ETH to the unregistered validator
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
          balance.add(1) // 1e9 Gwei = 1 ETH
        );

      await expect(tx).to.be.revertedWith("Insufficient WETH");
    });

    it("Should revert when staking a validator that hasn't been registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      // Stake ETH to the unregistered validator
      const tx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
          ETHInGwei // 1e9 Gwei = 1 ETH
        );

      await expect(tx).to.be.revertedWith("Not registered or verified");
    });

    // Remove validator
    it("Should remove a validator", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      // Register a new validator with the SSV Network
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testPublicKeys[0],
          testValidator.operatorIds,
          testValidator.sharesData,
          ethUnits("2"),
          emptyCluster
        );

      expect(
        await compoundingStakingSSVStrategy.validatorState(
          hashPubKey(testPublicKeys[0])
        )
      ).to.equal(1, "Validator state not 1 (REGISTERED)");

      // Withdraw from the validator
      const removeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testPublicKeys[0],
          testValidator.operatorIds,
          emptyCluster
        );

      await expect(removeTx)
        .to.emit(compoundingStakingSSVStrategy, "SSVValidatorRemoved")
        .withArgs(hashPubKey(testPublicKeys[0]), testValidator.operatorIds);
    });

    it("Should revert when removing a validator that is not registered", async () => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;
      expect(
        await compoundingStakingSSVStrategy.validatorState(
          hashPubKey(testPublicKeys[0])
        )
      ).to.equal(0, "Validator state not 0 (NON_REGISTERED)");

      // Try to remove a validator that is not registered
      const removeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testPublicKeys[0],
          testValidator.operatorIds,
          emptyCluster
        );

      await expect(removeTx).to.be.revertedWith("Validator not regd or exited");
    });

    it("Should revert when removing a validator that as found", async () => {
      await stakeValidatorsSingle(1, false, 0, ETHInGwei); // 1e9 Gwei = 1 ETH

      const { compoundingStakingSSVStrategy } = fixture;

      expect(
        await compoundingStakingSSVStrategy.validatorState(
          hashPubKey(testPublicKeys[0])
        )
      ).to.equal(2, "Validator state not 2 (STAKED)");
    });
  });

  describe("Deposit/Withdraw in the strategy", async () => {
    it("Should deposit ETH in the strategy", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;
      const balBefore =
        await compoundingStakingSSVStrategy.depositedWethAccountedFor();

      const depositAmount = parseEther("10");
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
    });

    it("Should depositAll ETH in the strategy when depositedWethAccountedFor is zero", async () => {
      const { compoundingStakingSSVStrategy, weth, josh } = fixture;

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

      const withdrawTx = compoundingStakingSSVStrategy
        .connect(sVault)
        .withdraw(josh.address, weth.address, depositAmount);

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");
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
    });

    it("Should withdraw ETH from the strategy, non withdraw some ETH", async () => {
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
        .withdraw(josh.address, weth.address, depositAmount);

      await expect(withdrawTx)
        .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
        .withArgs(weth.address, zero, depositAmount);

      expect(
        await compoundingStakingSSVStrategy.depositedWethAccountedFor()
      ).to.equal(0, "Withdraw amount not set properly");
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
    });
  });

  describe("Collect rewards", async () => {
    it("Should collect rewards from the strategy", async () => {
      const { compoundingStakingSSVStrategy, weth } = fixture;

      const harvesterAddress =
        await compoundingStakingSSVStrategy.harvesterAddress();
      const vaultAddress = await compoundingStakingSSVStrategy.VAULT_ADDRESS();

      const balanceBefore = await weth.balanceOf(vaultAddress);

      const rewardAmount = parseEther("10");
      // Send raw ETH to the strategy
      await setBalance(compoundingStakingSSVStrategy.address, rewardAmount);

      const collectTx = compoundingStakingSSVStrategy
        .connect(sHarvester)
        .collectRewardTokens();

      await expect(collectTx)
        .to.emit(compoundingStakingSSVStrategy, "RewardTokenCollected")
        .withArgs(harvesterAddress, weth.address, rewardAmount);

      expect(await weth.balanceOf(vaultAddress)).to.equal(
        balanceBefore.add(rewardAmount),
        "Rewards not collected properly"
      );
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

/**
 * Hashes a validator public key using the Beacon Chain's format.
 * @param {Buffer} pubKey - The public key of the validator.
 * @returns {string} - The hashed public key as a hex string.
 */
function hashPubKey(pubKeyHex) {
  // Convert hex string to Buffer
  const pubKey = Buffer.from(pubKeyHex.slice(2), "hex");
  const zeroBytes = Buffer.alloc(16, 0); // 16 bytes of zeros
  const data = Buffer.concat([pubKey, zeroBytes]);
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}
