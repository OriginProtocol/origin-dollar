const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
//const { solidityPack } = require("ethers/lib/utils");

const { isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const { ethUnits } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { zero } = require("../../utils/addresses");
const { calcDepositRoot } = require("../../tasks/beacon");
const crypto = require("crypto");

const {
  createFixtureLoader,
  compoundingStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(compoundingStakingSSVStrategyFixture);

const testValidator = {
  publicKey:
    "0xb3aad1f5a7b6bfbcd81b75f8a60e6e54cc64fbf09cb05a46f92bab8c6c017106d643d1de70027b5d30fa943b9207c543",
  index: 1930685,
  operatorIds: [424, 425, 426, 427],
  sharesData:
    "0xa819d1092f8c335cf85d318e9b6a4d82934190294c4a687a92ddb6cb9cd8ce3eee64676b899854535e34af10bd3575291077bb8617ed84424f80608a76664771129aea2f7a7cfcd390a6db04e87dfaefb170f057a2404210b04d1e1c0e1e9b4f886cef456a3dad1da1ac67a2976c59fe8cdb8442de60d70164ca8816dc69037a76a0ba7c06db9e954c67eadab7a4b5bdade0f92bc67ce24ef3e2a81141282124b8f00687fbf322604687b6eab9f62bdd23886c0418eb76878ffd49c26101b931a9dc12231d601a80aec054c382977168109863c1dfb477de7f32836a1d3ef53f76fe8c7c4c5ca79d8bd0194c30807f35b62fa199237b1ec2ad9f73a26a8dd561a6c9fd88b90a64a6a6e9e7c2a0401def70dd3858300366cbe1bcaec5fa8c009e57fe9150a98733ecc843d2c92f839ab31f9b73ee489ea059aff2c1576a8ae81a4db45ef417b07d640dea3fd1f70c279433a78044664e96d36c1fb7851166e601c42af2e9d7a8b7adeffd62a6e7cea8fb8de1610991b63609f833d5c7e2272c7caf07cd49645bf0d059a1f8b7b749b51b044de99df6511d378af6a72503ddb141344bb608c56965060d7d5d6bc6acb642a8b629f7997a5ebc1e6173acc538299acbd500686a0898ba6e33474fcef7f563dec872a5147b6cf13a0e86b4f8e3232698f24f429e9dfd6541bdd8be4e73d216740481ea08a77619fbc6cfc22bda7c43283d8b1057cb1cd66024735e739b875e55d5fcb5dd988dbfe9b2b2196f93d586643ba5642e2d486acb8a841e3901c53676e59ed6562ac0ea23d2e0f395bfbc12f75500352252d20178428df1799cda8c58b423a6c301549cbf75bffe97d1dd8d4ca9ef217e9f16ec2d6bb7fa5d04dc729bfafb7c262e33aa2b13bd4ff52e1050b7c9fe4768c63a8d82a5cb6c959a8e5d9170e82afb4f47b6055f246c883716a97299ee76eacb11b0d1e4beeaf5efd3ecd15f6395b40e9e29b06c308e22d833460b363c8e8ec5497f53866b1655ecca4fe5c34860a2f7d88fee2c3f98685af8729829c971fc1a16d6affb816d559e2440999e8db741148fa33db51a218ec2abdd6bdf190c4b7721b7dd36c1a1788bfb3bc14aeb979ce0e059b46bda1d182180fe46d7c56de8956f6ce64b85b2cca6e31e8c8ea30c3090bbe7454b217c80979bcdb0c802b5a4a0795edd4bcb11fdb7114bc1e59653274689530fcd6f5e84a5e7ad23e1f26129e48bfe450566791126dba7a3da69ad5e6730f498c267e3ca89760a9b6a7cb8dca4c6980fd58433193f78df0562429fb4bbe4e1484adb443e5dd50f3f4a91af0d3d37b987c623945cc5c6fb2db010fee3992c9a16d026410af8d608969da3367628feb29106497c6ef529dc7e48de81e1036c2bf0068d33e7f69ab65c3c13930b3aba111495c80e906542f6047fb7dcc3e770a7b43d87f310700d87a15ff138965bfc78f9d16e875825535d3aca4328aa725939e4a4544cd1fe8e772258485c41b6444b620200b3b2c5172a9ea13b79747157f1417fb8cb5eaf457571913696c779c7300991eeb51b7d61e99735aedb6e7aa9c24ec90f669706bafc28faa585e71d76db262d425d7882c2d7a00013ec4274c01d71564fae5e00f01f8c122728315fef1b80c4e8c1180a82565e82576e1018da9aaae9b1d3879350fd46f7cf3d93366236ea253d9dc4395237c2a06b27fcd19896294a320049773c3d9ac2001f75d3d0c34879f6ec31f4b43bde164147311d020bf5458deab4e5c804f00878d5938e228ce76034c34fff012051cd5a31cf7979cf41e6bc0c53a23b3ee4e8f0a9c20741a6167d0b15d8fbbc78adaaa687bb9c916aee900ebbeb7d75af",
  signature:
    "0x8754ee1ac90130cfb828172ed9e81fbbdf86f35298f05b3c152db673f2a6a82873e7acbdb5e2d0d035e253c396266254160e627e945a228a4c034157c7a4418efd08173e780ecbc30cedaae05f8239a453df924d8e8e11460f5e10b1c2024012",
  depositDataRoot:
    "0x9de115e290009d56d89d8d72d7ed1528aa2c2586609f879cbb4ba215f92f5d27",
};

// Proof from beacon chain slot 12145621 which is execution layer block 22923668
// So next block is 22923669 which is needed to set the parent beacon block root
const validatorProof = {
  proof:
    "0x0200000000000000000000008d84e1d10dd36de832549b525d09ae02825b84b56aa845b5bc63b3e02ed893c12395270ab812d5037f07848422ca5bca0c32ad227acaed3b0df28c00dea5d73add177d61599e0557652662aed8cb0d3660c8c55834045e71eeea95af8e6387ce442bc71c97520f0c73817a12fc938c02c2df6606485fc17ba0cacb97bf60a24649fa25e8f9735f00ba290f5326abdf1ed4b666920e73bb1cd62c992f3351d1ba6df0a34804b7a4f9f771febdaaae11fc7554c516f7330a2b034453ead5abd7a67f15da2acabaa5bd3e8337dcc72c013a44ae25366e122a3d7fef271e36ebece5b34ec3864fed40915d99c8a5ea2b22b4cbaa542ede39011814f92de0b7d3d210ae7e6483b145ed980107c9052536017334ba05e74bb60c8235fcd3a0cc8387d7d50dabb6bc80d251c7cb9d925e1e5005680b13c6e901446672fca79272f255180a281292b0521f9e210512147f9981570e0eba2f5da45e079aabec89844282bd8ce2a207d86d23d3acf91931b4164c3c82a8434711d2aae9e3714fb7f3f85ec4e0b94eebacca7020f6ba9db789289830d37c95c1dc780b83824c33ed9a4602c78cb294cabe50d5288daf7f974b7890d41d0389ecc18a95ef4052e45ef3813d4cb4936346b941b57d0cfec6e6d06cab25db4e5b575332a4f8e8fe5856e09fb0307faff4c4c86cd65f1232633985eee2e835bb5543ffbc9fae96a31e59159c5d02abe69fb16abf79e038bf188feaa215596f530c8a5d78f425c93b7ae2618708a663aeea2072b39f6c82a9e94208934aac447722502091694a22167adf183c7b8989e408b1166b3aeb3e58209a5fd4b8b455008a31a137c8f30ccc0c841cab8e43a450dd228a222cffc8fd7860f457e635b33bb6039def4a443b712c255e1ff4c45acdbfd3f33467499d0ea483d3f8e8517fd3c287c463bdfa01639dd97c4958e5f01466b524822e508b655fdd114eae2c35ad358af0476ab820285053f2ac14c6bf54ca249212a0985c31965e8a844a36f3fdd1445e68ab6ebb2f6d4d1e7804c2c561f64279aa294e71a90ed4e7e1356fbbc14a378a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206f85b21e0000000000000000000000000000000000000000000000000000000000c6341f000000000000000000000000000000000000000000000000000000000064f362ebbebed35401a76e4b6cd3571cb7d4aa34570a5c80968abaca292be98cb989749950f5c0a6759bc187f9ebb6fd274779f4cec4ed289be45b343f142ca5e788566b55848bce1bfd65c53e0ab603d80938d82d26d1b6a8e1052808c1ba5b0ed49f8bb58095e82dd7fa2c5502846df7b21e0939589102f5c68b1ba47b64b651c850a7171c1c56c23f7a1d3bdb116b072af1eb4f4bac80e1b8b7f68fdeca20d7241487ac6f78de4129bad248c82e219d89f3a22db57f1a5f7863ac78f67ecf8f2c61d63f9dd4a198f0de5ce9e1a7e2e38b57be9a716bbbbb4b545286b0268993a054be6fab494c904fa579e6333e89892bd616f8eaae4d23b03b984e1a1a5a",
  root: "0x52296912a63fba5a44ae4fb98542b917d41be7fd1955330caaa2c513e35b2a3b",
  leaf: "0xb1d3e454498123d8069f9138420c9a422fab4bf97f9786849b0d7daddb359f47",
  nextBlockTimestamp: 1752571487,
};

const testPublicKeys = [
  "0xb3aad1f5a7b6bfbcd81b75f8a60e6e54cc64fbf09cb05a46f92bab8c6c017106d643d1de70027b5d30fa943b9207c543",
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
      amount = 32
    ) => {
      const { compoundingStakingSSVStrategy, validatorRegistrator } = fixture;

      const amountGwei = BigNumber.from(amount.toString()).mul(ETHInGwei);

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

        const depositDataRoot = await calcDepositRoot(
          compoundingStakingSSVStrategy.address,
          "0x02",
          testPublicKeys[i],
          testValidator.signature,
          amount
        );

        const stakeTx = compoundingStakingSSVStrategy
          .connect(validatorRegistrator)
          .stakeEth(
            {
              pubkey: testPublicKeys[i],
              signature: testValidator.signature,
              depositDataRoot,
            },
            amountGwei
          );

        await stakeTx;

        await expect(stakeTx)
          .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
          .withArgs(
            hashPubKey(testPublicKeys[i]),
            depositDataRoot,
            testPublicKeys[i],
            amountGwei.mul(GweiInWei) // Convert Gwei to Wei
          );

        expect(
          await compoundingStakingSSVStrategy.validatorState(
            hashPubKey(testPublicKeys[i])
          )
        ).to.equal(2, "Validator state not 2 (STAKED)");
      }
    };

    it("Should stake to a validator: 1 ETH", async () => {
      await stakeValidatorsSingle(1, false, 0, 1);
    });

    it("Should stake to 2 validators: 1 ETH", async () => {
      await stakeValidatorsSingle(2, false, 0, 1);
    });

    it("Should stake 1 ETH then 32 ETH to a validator", async () => {
      const {
        compoundingStakingSSVStrategy,
        validatorRegistrator,
        beaconRoots,
      } = fixture;

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
        testPublicKeys[0],
        testValidator.signature,
        1
      );

      // Stake 1 ETH to the new validator
      await compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testPublicKeys[0],
            signature: testValidator.signature,
            depositDataRoot,
          },
          ETHInGwei // 1e9 Gwei = 1 ETH
        );

      // The hash of the public key should match the leaf in the proof
      expect(hashPubKey(testPublicKeys[0])).to.equal(validatorProof.leaf);

      // Set BeaconRoot for timestamp
      await beaconRoots.setBeaconRoot(
        validatorProof.nextBlockTimestamp,
        validatorProof.root
      );

      // Verify the validator
      await compoundingStakingSSVStrategy.verifyValidator(
        validatorProof.nextBlockTimestamp,
        testValidator.index,
        hashPubKey(testPublicKeys[0]),
        validatorProof.proof
      );

      /*
      // Need to have it verifier first!
      // Stake 32 ETH to the new validator
      const stakeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testPublicKeys[0],
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
          BigNumber.from("32").mul(GweiInWei) // 32 ETH
        );

      await expect(stakeTx)
        .to.emit(compoundingStakingSSVStrategy, "ETHStaked")
        .withArgs(
          hashPubKey(testPublicKeys[0]),
          testPublicKeys[0],
          BigNumber.from("32").mul(GweiInWei) // Convert Gwei to Wei
        );
        */
    });

    it("Should revert when first stake amount is not exactly 1 ETH", async () => {
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

      // Try to stake 32 ETH to the new validator
      const stakeTx = compoundingStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth(
          {
            pubkey: testPublicKeys[0],
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
          BigNumber.from("32").mul(GweiInWei) // 32 ETH
        );

      await expect(stakeTx).to.be.revertedWith("First deposit not 1 ETH");
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
      await stakeValidatorsSingle(1, false, 0, 1);

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
