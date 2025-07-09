const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
const {
  setBalance,
  setStorageAt,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
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
const minFixAccountingCadence = 7200 + 1;
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
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
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
      const { compoundingStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await compoundingStakingSSVStrategy
        .connect(governor)
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

    it("Non governor should not be able to update the fuse intervals", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(strategist)
          .setFuseInterval(parseEther("21.6"), parseEther("25.6"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Fuse interval start needs to be larger than fuse end", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("25.6"), parseEther("21.6"))
      ).to.be.revertedWith("Incorrect fuse interval");
    });

    it("There should be at least 4 ETH between interval start and interval end", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("21.6"), parseEther("25.5"))
      ).to.be.revertedWith("Incorrect fuse interval");
    });

    it("Revert when fuse intervals are larger than 32 ether", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      await expect(
        compoundingStakingSSVStrategy
          .connect(governor)
          .setFuseInterval(parseEther("32.1"), parseEther("32.1"))
      ).to.be.revertedWith("Incorrect fuse interval");
    });

    it("Governor should be able to change fuse interval", async () => {
      const { compoundingStakingSSVStrategy, governor } = fixture;

      const fuseStartBn = parseEther("22.6");
      const fuseEndBn = parseEther("26.6");

      const tx = await compoundingStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(fuseStartBn, fuseEndBn);

      await expect(tx)
        .to.emit(compoundingStakingSSVStrategy, "FuseIntervalUpdated")
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
          const { compoundingStakingSSVStrategy, governor, weth } = fixture;

          // setup state
          if (ethBalance.gt(0)) {
            await setBalance(compoundingStakingSSVStrategy.address, ethBalance);
          }

          await setActiveDepositedValidators(30, compoundingStakingSSVStrategy);
          await setConsensusRewards(
            previousConsensusRewards,
            compoundingStakingSSVStrategy
          );

          // check accounting values
          const tx = await compoundingStakingSSVStrategy
            .connect(governor)
            .doAccounting();

          if (expectedConsensusRewards.gt(BigNumber.from("0"))) {
            await expect(tx)
              .to.emit(
                compoundingStakingSSVStrategy,
                "AccountingConsensusRewards"
              )
              .withArgs(expectedConsensusRewards);
          } else {
            await expect(tx).to.not.emit(
              compoundingStakingSSVStrategy,
              "AccountingConsensusRewards"
            );
          }

          if (expectedValidatorsFullWithdrawals > 0) {
            const ethWithdrawnToVault = parseEther("32").mul(
              expectedValidatorsFullWithdrawals
            );
            await expect(tx)
              .to.emit(
                compoundingStakingSSVStrategy,
                "AccountingFullyWithdrawnValidator"
              )
              .withArgs(
                expectedValidatorsFullWithdrawals,
                30 - expectedValidatorsFullWithdrawals,
                ethWithdrawnToVault
              );

            await expect(tx)
              .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
              .withArgs(weth.address, zero, ethWithdrawnToVault);
          } else {
            await expect(tx).to.not.emit(
              compoundingStakingSSVStrategy,
              "AccountingFullyWithdrawnValidator"
            );
          }

          if (fuseBlown) {
            await expect(tx).to.emit(compoundingStakingSSVStrategy, "Paused");
          } else {
            await expect(tx).to.not.emit(
              compoundingStakingSSVStrategy,
              "Paused"
            );
          }

          if (slashDetected) {
            const fullExitEthWithdrawnToVault = parseEther("32").mul(
              expectedValidatorsFullWithdrawals
            );
            const slashedEthRemaining = ethBalance.sub(
              fullExitEthWithdrawnToVault
            );

            await expect(tx)
              .to.emit(
                compoundingStakingSSVStrategy,
                "AccountingValidatorSlashed"
              )
              .withNamedArgs({
                remainingValidators: 30 - expectedValidatorsFullWithdrawals - 1,
              });

            await expect(tx)
              .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
              .withArgs(weth.address, zero, slashedEthRemaining);
          } else {
            await expect(tx).to.not.emit(
              compoundingStakingSSVStrategy,
              "AccountingValidatorSlashed"
            );
          }
        });
      }
    });

    it("Only strategist is allowed to manually fix accounting", async () => {
      const { compoundingStakingSSVStrategy, strategist, governor } = fixture;

      await compoundingStakingSSVStrategy.connect(strategist).pause();
      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        compoundingStakingSSVStrategy.connect(governor).manuallyFixAccounting(
          1, //_validatorsDelta
          parseEther("2"), //_consensusRewardsDelta,
          parseEther("2") //_ethToVault
        )
      ).to.be.revertedWith("Caller is not the Strategist");
    });

    it("Accounting needs to be paused in order to call fix accounting function", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      // unit test fixture sets OUSD governor as accounting governor
      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          1, //_validatorsDelta
          parseEther("2"), //_consensusRewardsDelta
          parseEther("2") //_ethToVault
        )
      ).to.be.revertedWith("Pausable: not paused");
    });

    it("Validators delta should not be <-4 or >4 for fix accounting function", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await compoundingStakingSSVStrategy.connect(strategist).pause();
      await mine(minFixAccountingCadence);

      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          -4, //_validatorsDelta
          0, //_consensusRewardsDelta,
          0 //_ethToVault
        )
      ).to.be.revertedWith("Invalid validatorsDelta");

      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          4, //_validatorsDelta
          0, //_consensusRewardsDelta
          0 //_ethToVault
        )
      ).to.be.revertedWith("Invalid validatorsDelta");
    });

    it("Consensus rewards delta should not be <-333> and >333 for fix accounting function", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await compoundingStakingSSVStrategy.connect(strategist).pause();
      await mine(minFixAccountingCadence);

      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          0, //_validatorsDelta
          parseEther("-333"), //_consensusRewardsDelta
          0 //_ethToVault
        )
      ).to.be.revertedWith("Invalid consensusRewardsDelta");

      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          0, //_validatorsDelta
          parseEther("333"), //_consensusRewardsDelta
          0 //_ethToVault
        )
      ).to.be.revertedWith("Invalid consensusRewardsDelta");
    });

    it("WETH to Vault amount should not be > 96 for fix accounting function", async () => {
      const { compoundingStakingSSVStrategy, strategist } = fixture;

      await compoundingStakingSSVStrategy.connect(strategist).pause();
      await mine(minFixAccountingCadence);

      await expect(
        compoundingStakingSSVStrategy.connect(strategist).manuallyFixAccounting(
          0, //_validatorsDelta
          0, //_consensusRewardsDelta
          parseEther("97") //_ethToVault
        )
      ).to.be.revertedWith("Invalid wethToVaultAmount");
    });

    describe("Should allow strategist to recover paused contract", async () => {
      for (const validatorsDelta of [-3, -2, -1, 0, 1, 2, 3]) {
        it(`by changing validators by ${validatorsDelta}`, async () => {
          const { compoundingStakingSSVStrategy, strategist } = fixture;

          await setActiveDepositedValidators(10, compoundingStakingSSVStrategy);

          await compoundingStakingSSVStrategy.connect(strategist).pause();
          await mine(minFixAccountingCadence);

          const activeDepositedValidatorsBefore =
            await compoundingStakingSSVStrategy.activeDepositedValidators();

          const tx = await compoundingStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(validatorsDelta, 0, 0);

          expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "AccountingManuallyFixed")
            .withArgs(validatorsDelta, 0, 0);

          expect(
            await compoundingStakingSSVStrategy.activeDepositedValidators()
          ).to.equal(
            activeDepositedValidatorsBefore.add(validatorsDelta),
            "active deposited validators not updated"
          );
        });
      }

      for (const delta of [-332, -320, -1, 0, 1, 320, 332]) {
        it(`by changing consensus rewards by ${delta}`, async () => {
          const { compoundingStakingSSVStrategy, strategist } = fixture;

          await setBalance(
            compoundingStakingSSVStrategy.address,
            parseEther("670")
          );
          await setConsensusRewards(
            parseEther("336"),
            compoundingStakingSSVStrategy
          );
          await setActiveDepositedValidators(
            10000,
            compoundingStakingSSVStrategy
          );

          await compoundingStakingSSVStrategy.connect(strategist).pause();
          await mine(minFixAccountingCadence);
          const consensusRewardsDelta = parseEther(delta.toString());

          const tx = await compoundingStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(0, consensusRewardsDelta, 0);

          expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "AccountingManuallyFixed")
            .withArgs(0, consensusRewardsDelta, 0);

          expect(
            await compoundingStakingSSVStrategy.consensusRewards()
          ).to.equal(
            await compoundingStakingSSVStrategy.provider.getBalance(
              compoundingStakingSSVStrategy.address
            ),
            "consensus rewards matches eth balance"
          );
        });
      }

      for (const eth of [0, 1, 26, 32, 63, 65, 95]) {
        it(`by sending ${eth} ETH wrapped to WETH to the vault`, async () => {
          const { compoundingStakingSSVStrategy, strategist } = fixture;

          const wethToVaultBn = parseEther(`${eth}`);

          // add a bit more ETH so we don't completely empty the contract
          await setBalance(
            compoundingStakingSSVStrategy.address,
            wethToVaultBn.add(parseEther("2"))
          );

          await compoundingStakingSSVStrategy.connect(strategist).pause();
          await mine(minFixAccountingCadence);
          const ethBefore =
            await compoundingStakingSSVStrategy.provider.getBalance(
              compoundingStakingSSVStrategy.address
            );

          const tx = await compoundingStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(0, 0, wethToVaultBn);

          expect(tx)
            .to.emit(compoundingStakingSSVStrategy, "AccountingManuallyFixed")
            .withArgs(0, 0, wethToVaultBn);

          expect(
            await compoundingStakingSSVStrategy.provider.getBalance(
              compoundingStakingSSVStrategy.address
            )
          ).to.equal(
            ethBefore.sub(wethToVaultBn),
            "consensus rewards not updated"
          );

          expect(
            await compoundingStakingSSVStrategy.consensusRewards()
          ).to.equal(
            await compoundingStakingSSVStrategy.provider.getBalance(
              compoundingStakingSSVStrategy.address
            ),
            "consensus rewards matches eth balance"
          );
        });
      }

      it("by marking a validator as withdrawn when severely slashed and sent its funds to the vault", async () => {
        const { compoundingStakingSSVStrategy, governor, strategist, weth } =
          fixture;

        // setup initial state
        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        // setup 1 validator so one can be deducted later in the test
        await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            1, //_validatorsDelta
            0, //_consensusRewardsDeltaDelta
            0 //_ethToVault
          );

        // a validator has been slashed and penalized by 8 ETH
        await setBalance(
          compoundingStakingSSVStrategy.address,
          parseEther("24")
        );

        // run the accounting
        const tx = await compoundingStakingSSVStrategy
          .connect(governor)
          .doAccounting();
        // fuse blown contract paused
        await expect(tx).to.emit(compoundingStakingSSVStrategy, "Paused");
        await mine(minFixAccountingCadence);

        // unit test fixture sets OUSD governor as accounting governor
        const tx2 = await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            -1, //_validatorsDelta
            0, //_consensusRewardsDeltaDelta
            parseEther("24") //_ethToVault
          );

        expect(tx2)
          .to.emit(compoundingStakingSSVStrategy, "AccountingManuallyFixed")
          .withArgs(
            -1, // validatorsDelta
            0, // consensusRewards
            parseEther("24")
          );

        expect(tx2)
          .to.emit(compoundingStakingSSVStrategy, "Withdrawal")
          .withArgs(weth.address, zero, parseEther("24"));
      });

      it("by changing all three manuallyFixAccounting delta values", async () => {
        const { compoundingStakingSSVStrategy, strategist, josh, weth } =
          fixture;

        await setBalance(
          compoundingStakingSSVStrategy.address,
          parseEther("5")
        );
        await weth
          .connect(josh)
          .transfer(compoundingStakingSSVStrategy.address, parseEther("5"));

        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        // unit test fixture sets OUSD governor as accounting governor
        const tx = await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            1, //_validatorsDelta
            parseEther("2.3"), //_consensusRewardsDeltaDelta
            parseEther("2.2") //_ethToVault
          );

        expect(tx)
          .to.emit(compoundingStakingSSVStrategy, "AccountingManuallyFixed")
          .withArgs(
            1, // validatorsDelta
            parseEther("2.3"), // consensusRewards
            parseEther("2.2")
          );
      });

      it("Calling manually fix accounting too often should result in an error", async () => {
        const { compoundingStakingSSVStrategy, strategist } = fixture;

        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            0, //_consensusRewardsDelta
            0 //_ethToVault
          );

        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence - 4);
        await expect(
          compoundingStakingSSVStrategy
            .connect(strategist)
            .manuallyFixAccounting(
              0, //_validatorsDelta
              0, //_consensusRewardsDelta
              0 //_ethToVault
            )
        ).to.be.revertedWith("Fix accounting called too soon");
      });

      it("Calling manually fix accounting twice with enough blocks in between should pass", async () => {
        const { compoundingStakingSSVStrategy, strategist } = fixture;

        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            0, //_consensusRewardsDelta
            0 //_ethToVault
          );

        await compoundingStakingSSVStrategy.connect(strategist).pause();
        await mine(minFixAccountingCadence);
        await compoundingStakingSSVStrategy
          .connect(strategist)
          .manuallyFixAccounting(
            0, //_validatorsDelta
            0, //_consensusRewardsDelta
            0 //_ethToVault
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
          const {
            compoundingStakingSSVStrategy,
            nativeStakingFeeAccumulator,
            governor,
            weth,
            josh,
          } = fixture;

          // setup state
          if (consensusRewards.gt(BigNumber.from("0"))) {
            // set the reward eth on the strategy
            await setBalance(
              compoundingStakingSSVStrategy.address,
              consensusRewards
            );
          }
          if (feeAccumulatorEth.gt(BigNumber.from("0"))) {
            // set execution layer rewards on the fee accumulator
            await setBalance(
              nativeStakingFeeAccumulator.address,
              feeAccumulatorEth
            );
          }
          if (deposits.gt(BigNumber.from("0"))) {
            // send eth to the strategy as if Vault would send it via a Deposit function
            await weth
              .connect(josh)
              .transfer(compoundingStakingSSVStrategy.address, deposits);
          }

          // set the correct amount of staked validators
          await setActiveDepositedValidators(
            nrOfActiveDepositedValidators,
            compoundingStakingSSVStrategy
          );
          await setConsensusRewards(
            consensusRewards,
            compoundingStakingSSVStrategy
          );

          // run the accounting
          await compoundingStakingSSVStrategy.connect(governor).doAccounting();
        });

        it(`then should harvest ${testCase.expectedHarvester} WETH`, async () => {
          const {
            compoundingStakingSSVStrategy,
            nativeStakingFeeAccumulator,
            oethHarvester,
            weth,
          } = fixture;
          const sHarvester = await impersonateAndFund(oethHarvester.address);

          const harvesterWethBalanceBefore = await weth.balanceOf(
            oethHarvester.address
          );
          const tx = await compoundingStakingSSVStrategy
            .connect(sHarvester)
            .collectRewardTokens();

          if (expectedHarvester.gt(BigNumber.from("0"))) {
            await expect(tx)
              .to.emit(compoundingStakingSSVStrategy, "RewardTokenCollected")
              .withArgs(oethHarvester.address, weth.address, expectedHarvester);
          } else {
            await expect(tx).to.not.emit(
              compoundingStakingSSVStrategy,
              "RewardTokenCollected"
            );
          }

          if (feeAccumulatorEth > 0) {
            await expect(tx)
              .to.emit(nativeStakingFeeAccumulator, "ExecutionRewardsCollected")
              .withArgs(
                compoundingStakingSSVStrategy.address,
                feeAccumulatorEth
              );
          } else {
            await expect(tx).to.not.emit(
              nativeStakingFeeAccumulator,
              "ExecutionRewardsCollected"
            );
          }

          const harvesterBalanceDiff = (
            await weth.balanceOf(oethHarvester.address)
          ).sub(harvesterWethBalanceBefore);
          expect(harvesterBalanceDiff).to.equal(expectedHarvester);
        });

        it(`then the strategy should have a ${testCase.expectedBalance} balance`, async () => {
          const { compoundingStakingSSVStrategy, weth } = fixture;

          expect(
            await compoundingStakingSSVStrategy.checkBalance(weth.address)
          ).to.equal(expectedBalance);
        });
      });
    }
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

const setActiveDepositedValidators = async (
  validators,
  compoundingStakingSSVStrategy
) => {
  await setStorageAt(compoundingStakingSSVStrategy.address, 52, validators);

  expect(
    await compoundingStakingSSVStrategy.activeDepositedValidators()
  ).to.equal(validators, "validators no set properly");
};

const setConsensusRewards = async (
  consensusRewards,
  compoundingStakingSSVStrategy
) => {
  await setStorageAt(
    compoundingStakingSSVStrategy.address,
    104,
    consensusRewards
  );

  expect(await compoundingStakingSSVStrategy.consensusRewards()).to.equal(
    consensusRewards,
    "consensusRewards no set properly"
  );
};

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
