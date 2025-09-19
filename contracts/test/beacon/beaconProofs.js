const { expect } = require("chai");
const { hexZeroPad } = require("ethers").utils;

const { beaconChainFixture } = require("../_fixture");
const { ZERO_BYTES32, MAX_UINT64 } = require("../../utils/constants");
const { hashPubKey } = require("../../utils/beacon");
const { BigNumber } = require("ethers");

describe("Beacon chain proofs", async () => {
  let fixture;
  beforeEach(async () => {
    fixture = await beaconChainFixture();
  });
  describe("Should calculate generalized index", () => {
    it("from height and index", async () => {
      const { beaconProofs } = fixture;
      expect(await beaconProofs.concatGenIndices(1, 0, 0)).eq(1);
      expect(await beaconProofs.concatGenIndices(1, 1, 0)).eq(2);
      expect(await beaconProofs.concatGenIndices(1, 1, 1)).eq(3);
      expect(await beaconProofs.concatGenIndices(1, 2, 0)).eq(4);
      expect(await beaconProofs.concatGenIndices(1, 2, 3)).eq(7);
      expect(await beaconProofs.concatGenIndices(1, 3, 0)).eq(8);
      expect(await beaconProofs.concatGenIndices(1, 3, 1)).eq(9);
      expect(await beaconProofs.concatGenIndices(1, 3, 2)).eq(10);
      expect(await beaconProofs.concatGenIndices(1, 3, 6)).eq(14);
      expect(await beaconProofs.concatGenIndices(1, 3, 7)).eq(15);
      expect(await beaconProofs.concatGenIndices(1, 6, 12)).eq(76);
    });
    it("for BeaconBlock.slot", async () => {
      const { beaconProofs } = fixture;

      expect(await beaconProofs.concatGenIndices(1, 3, 0)).eq(8);
    });
    it("for BeaconBlock.parentRoot", async () => {
      const { beaconProofs } = fixture;

      expect(await beaconProofs.concatGenIndices(1, 3, 2)).eq(10);
    });
    it("for BeaconBlock.body", async () => {
      const { beaconProofs } = fixture;

      expect(await beaconProofs.concatGenIndices(1, 3, 4)).eq(12);
    });
    it("for BeaconBlock.BeaconBlockBody.randaoReveal", async () => {
      const { beaconProofs } = fixture;

      const beaconBlockBodyGenIndex = await beaconProofs.concatGenIndices(
        1,
        3,
        4
      );
      expect(
        await beaconProofs.concatGenIndices(beaconBlockBodyGenIndex, 4, 0)
      ).eq(192);
    });
    it("for BeaconBlock.BeaconState.balances", async () => {
      const { beaconProofs } = fixture;

      const beaconStateGenIndex = await beaconProofs.concatGenIndices(1, 3, 3);
      expect(
        await beaconProofs.concatGenIndices(beaconStateGenIndex, 6, 12)
      ).eq(716);
    });
    it("for BeaconBlock.body.executionPayload.blockNumber", async () => {
      const { beaconProofs } = fixture;

      const beaconBlockBodyGenIndex = await beaconProofs.concatGenIndices(
        1,
        3,
        4
      );
      const executionPayloadGenIndex = await beaconProofs.concatGenIndices(
        beaconBlockBodyGenIndex,
        4,
        9
      );
      expect(
        await beaconProofs.concatGenIndices(executionPayloadGenIndex, 5, 6)
      ).eq(6438);
    });
  });
  describe("Should merkleize", () => {
    it("pending deposit", async () => {
      const { beaconProofs } = fixture;

      const publicKey =
        "0xa18bd0e852ab796e8020fb277090aa474fe39a2fce99004dd247324fdbf57584da5ef6a32d1121210b9e7c2b95ecf667";
      const pubKeyHash = hashPubKey(publicKey);
      const withdrawalCredentials =
        "0x0100000000000000000000006f37216b54ea3fe4590ab3579fab8fd7f6dcf13f";
      const amountGwei = 32000000000;
      const signature =
        "0x97089277b0819bc5ecab141a2f65274994b4e7940de2e0278eb3714b4e9e85ae5814faa760e53c29b8c15bbb9b30e0c00e07f2b6d16fd1f1174a8c90d172b081d5d5b2b30b94f435045d209598232db27a31a76e652f95ddbfa453c409890668";
      const slot = 12235962;
      const expectedRoot =
        "0xc27ca5bb5e66430b4eccd9aa5a90bc1783fa8aa2279461eff32751572a98d819";
      const root = await beaconProofs.merkleizePendingDeposit(
        pubKeyHash,
        withdrawalCredentials,
        amountGwei,
        signature,
        slot
      );

      expect(root).to.eq(expectedRoot);
    });

    it("BLS signature", async () => {
      const { beaconProofs } = fixture;

      const signature =
        "0xab2de5db0c4e6d61b29a48e4269251bff4565063126fcd5f77a113df22c684db709ba7c95c1eab08620090dac7267f5a07ce7e6a873ce6ec4c609c50419923b7cffdf9384d4157f19deb56f64e9072b464aa4ec0466918ca93ab4e581fab8187";
      const expectedRoot =
        "0x5b449fedb4e3fc86a00c8b9c6de4a537c73e342bb1a83c1141d954e7912de501";
      const root = await beaconProofs.merkleizeSignature(signature);

      expect(root).to.eq(expectedRoot);
    });
  });
  describe("Balances container to beacon block root proof", () => {
    const beaconRoot =
      "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b0474";
    const balancesContainerLeaf =
      "0xa4181bd72c96848c06c64a28ce7c21563b6063f289ec27d2b5f05aae4dfdb57d";
    const proof =
      "0x4938a396a5a5651cdeab2dbc058f866ebcda5fd4fc85a152f22dba474c009791732bb29b9703de0515129d79481b879a3dd9123eeffe7bf8afd4aaff84378560ab5cfe225d99d908dd717ced212090862faf3d42ef6d49b90e5a3d53a13a187ba1ba6d4a2373a34ace4c3bdff56faaf6dc7e93b538bab62355581ae2b679cf30b9db93bd03ab076a7c7dce90b2fcd3162c71977e7e58a31e1ca4a0dded313be333f54b1fbc27a269a843a4d3838e0013984cc884b7a88e4d7f528a1c9a76c98c41dd7ebb8c56a217d6881589c4e09ce0055bea097be50e2dcaa07757da3df8bb1561936559cd736ba1d1802b048e118c414a17c48ff04189f0b8df768d599c9171c990856b4ce5cd0c635561d221a760c5be68a43c7a26b82c92800a16e05ddc";

    it("Should verify", async () => {
      const { beaconProofs } = fixture;

      await beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
    });
    it("Fail to verify with zero beacon block root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot = ZERO_BYTES32;

      const tx = beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid block root");
    });
    it("Fail to verify with invalid beacon block root", async () => {
      const { beaconProofs } = fixture;

      // The last byte is changed to aa
      const beaconRoot =
        "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b04aa";

      const tx = beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid balance container proof");
    });
    it("Fail to verify with zero padded proof", async () => {
      const { beaconProofs } = fixture;

      const proof = hexZeroPad("0x", 288);

      const tx = beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid balance container proof");
    });
    it("Fail to verify with invalid proof", async () => {
      const { beaconProofs } = fixture;

      // Changed the first byte to aa
      const proof =
        "0xaa38a396a5a5651cdeab2dbc058f866ebcda5fd4fc85a152f22dba474c009791732bb29b9703de0515129d79481b879a3dd9123eeffe7bf8afd4aaff84378560ab5cfe225d99d908dd717ced212090862faf3d42ef6d49b90e5a3d53a13a187ba1ba6d4a2373a34ace4c3bdff56faaf6dc7e93b538bab62355581ae2b679cf30b9db93bd03ab076a7c7dce90b2fcd3162c71977e7e58a31e1ca4a0dded313be333f54b1fbc27a269a843a4d3838e0013984cc884b7a88e4d7f528a1c9a76c98c41dd7ebb8c56a217d6881589c4e09ce0055bea097be50e2dcaa07757da3df8bb1561936559cd736ba1d1802b048e118c414a17c48ff04189f0b8df768d599c9171c990856b4ce5cd0c635561d221a760c5be68a43c7a26b82c92800a16e05ddc";

      const tx = beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid balance container proof");
    });
    it("Fail to verify with invalid beacon container root", async () => {
      const { beaconProofs } = fixture;

      // Changed the first bytes to aa
      const balancesContainerLeaf =
        "0xaa181bd72c96848c06c64a28ce7c21563b6063f289ec27d2b5f05aae4dfdb57d";

      const tx = beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid balance container proof");
    });
  });
  describe("Validator balance to balances container proof", () => {
    const balancesContainerRoot =
      "0xdbdf8b18bb50a2ac84864bf12779da475aca1e2b98854b2a1b02506396250eff";
    const validatorIndex = 1770193;
    const balanceLeaf =
      "0x0000000000000000f5b87473070000000000000000000000dd06757307000000";
    const proof =
      "0xe882747307000000b3ae74730700000022fe7473070000000000000000000000a0e70a60b292ba301171cec7c6fc2cbab7f3bf8f0dffe2cae5eaef133d3882f8868061031e7c19c701169dba0ff8f8a16652b144b1601012aef58da66aede34f31f54712eae171f1d7115be3e615f0987382f783a846ae438a894398c615efd1cc013d1c8bf5292755492ec4672e7c4a46e680a863f85d6de9ea59412f19c5350e7ee4a0132b26adb417f5d668ee4ec6311fa6552a3f2de928a9df72946fddf09dd9e3994b879b7de86f47c5f5178e3371493dee98b9c5830a9887fda366dea4c7ead58860119d8156dd5a3eb5251eb92dfe2d9c16d3c13cea6910f66af979f2333359c758ba132cb875a4ab011c5e2997f9a9d5d055babf64822b1aca2e13f1bf325f10a9ee255ff13647c4a6237ed79411f5f3fe148c0d7dafbcaae467da03027c76f6fadae20f8aa378b9e297c02d5bf0f557287613cfa049e22ec8c8980ec970e9372314604a5d1d561c967f76f072942c82c126a872ee804848a850ecd282ea91cfb0f1785b6d9cfdf6cddd0694466023e232ee9c8d9fdf264f5ef130fba42247e45be5fed39f7738913901f0659a4b28f5f8161bf82af82b6a094cfc89fa921156f8d23ae5ff5a27b3a362bab64ba53cd6ba38757f94bf3b93542f2852662b715121ee217b0832c95ee45923102b3d39f76bf11dadd2474de2bcd6611c1973c323c3046a54b239454b99a78a8af5e881d601e29e39d98ed70b36fa061cd2fc5311499e6939e2ba3737e47d319dfbcf370deee1c9cac017b945f88eb211f956a065b2ce0f0597ad85e4779af2b74ec8b1d0099b2f71356abaec97644f25f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a7476b51d0000000000000000000000000000000000000000000000000000000000";

    it("Should verify with balance", async () => {
      const { beaconProofs } = fixture;

      const balance = await beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      expect(balance).to.eq("32001800437");
    });
    it("Fail to verify with incorrect balance", async () => {
      const { beaconProofs } = fixture;

      const balanceLeaf =
        "0x0000000000000000f5b87473070000000000000000000000dd06757306000000";

      const tx = beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      await expect(tx).to.be.revertedWith("Invalid balance proof");
    });
    it("Fail to verify with zero container root", async () => {
      const { beaconProofs } = fixture;

      const balancesContainerRoot = ZERO_BYTES32;

      const tx = beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      await expect(tx).to.be.revertedWith("Invalid container root");
    });
    it("Fail to verify with incorrect container root", async () => {
      const { beaconProofs } = fixture;

      const balancesContainerRoot =
        "0xdbdf8b18bb50a2ac84864bf12779da475aca1e2b98854b2a1b02506396250eaa";

      const tx = beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      await expect(tx).to.be.revertedWith("Invalid balance proof");
    });
    it("Fail to verify with zero padded proof", async () => {
      const { beaconProofs } = fixture;

      const proof = hexZeroPad("0x", 1248);

      const tx = beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      await expect(tx).to.be.revertedWith("Invalid balance proof");
    });
    it("Fail to verify with no balance", async () => {
      const { beaconProofs } = fixture;

      const balancesContainerRoot =
        "0x4830cdf0422b784d8efeffce36b3e58c08f71404edd1115edf4bd4cf4e80354a";
      const validatorIndex = 1770193;
      const balanceLeaf =
        "0x00000000000000000000000000000000000000000000000025d28c7307000000";
      const proof =
        "0x538b8c730700000076af8c730700000061a68c730700000000000000000000009eaac9c5af52f4c6e96fec410ff8b1ff1f8ccf045487fa72c11486955329504111216e61bd2dfab786cfed2a29205b60b968f1f35d562a625e7b25295c5f8ce91627ea1634fe3ccbdb4f7f5392da1af86cf1c9bb6edb52553239023f13d21f5fd1f872cd106cfae02d4f78cae00600778b2e583e7472cc6c3383386631110ac723664a2530d1555f2d799180dc50f5fbfaa53da3e0c40fa2c9115bcd7ff46b89b22824597545d61a2ae64a66daca00c92bd4b3fc3897be1a5f72b0a7041da0b11b39856c9afcaa6eb24247450cf24bcae344b9b298e9daceb740e8997a4e0ec7ccdcba46d9a8d6d6c139e4540d1c10610c96d0b4d817d12e2bc3e99de9aedf9422156e0c6f5978db9e96d8e13fe7a8652f78b33af44d368b092252fd39145c80713d22e5cbb3e6a94e24ddcf79fe867a315a25ea8ee1915ccd6cf982eed922b50b6e700f0efd267a905143deed182ab9f93846dff91d57a510a1ece20e238a6a59c1dc05d70e5aea1483faee9e7c0dcd2fba028c0e162c0107749c339fafd89f9010b30693b00cadf785839dcd8ea23c4a87a2452c3aad0d656f5c69565cc34a4c322b39a028f12887c348d26bea3f2054aa4a4c8a442a4a190c4b615f6cb0f61ee54fb062540a21583bc4c4bd0f5806db6fe0a99211b4ba94487318985281815ab0c9d9216a00fb65a8e25be3a4bb2a486deec0d281a45da03edfcc77f067ce63fc9a41892d10cb75f59b373f4658811eb668d93f256ddd8ccf0930136358ecc0313a61cee570ddbb7cc127f60091fd8b0cbc5ae95a9025cb0c78e9cf566d27f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7301e0000000000000000000000000000000000000000000000000000000000";

      const balance = await beaconProofs.verifyValidatorBalance(
        balancesContainerRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      expect(balance).to.eq("0");
    });
  });
  describe("Validator public key to beacon block root proof", () => {
    // From Hoodi
    const beaconRoot =
      "0x3f28c90c42bb5e0aa37b8ca105a1f109799e61b2bb682cae3fe8b500e0af687d";
    const validatorIndex = 1217565;
    const publicKeyLeaf =
      "0x867868ec64c9354c80e29feeb6e36ed6b1073bd5fea3353543f7426689af8fd2";
    const proof =
      "0x020000000000000000000000ee45c342e7a183b1c2dee96c7278ab3bece36dec083d993e840e913d2cb98799d46c5631598dfbb681c1af772a0d5fb62a301f972c84ba62dc4e7011c24fb0878e3ef2245a9e2cf2cacbbaf2978a4efa4703728352499952dbcb7ec23c556afa297d7919adfac3e727b832082e95e1fee1d19e44f6f40a072763e2bae1d4c47043cd5f6baa3c7a87c5c3a0eb0a1393ed62d56ec15703728aef5ef6f1d1c944c0a70d1880cccb4ed3fa2c91a042b0be49d2614753e49bb4f1c98b96345f10bbf63ed989b1d9032f97727fee2340bed0f2776cd50a2cf2960f326cc55975be6d14ccd881987a6706c859801c11fc5ccb290cbc2303b705cc4e0702b73370ae7430fbf48d6c30b7b679004a73977d60b3f5035c884423a60780c5b128455a1e502031975ed0c11c460c4a8c1b16ec949e85f583569887eb0ddba57e35f6d286673802a4af5975e22506c7cf4c64bb6be5ee11527f2c26846476fd5fc54a5d43385167c95144f2643f533cc85bb9d16b782f8d7db193506d86582d252405b840018792cad2bf1259f1ef5aa5f887e13cb2f0094f51e14ff7d34eb2887de014b316054b5bbb11918f94a8c6d0b638ab632d23b93b82736cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220570206ba0152ca41d56df2e853d8e059e1f62bb761d8c61908c8caa177558d42df6af5f5bbdb6be9ef8aa618e4bf8073960867171e29676f8b284dea6a08a85eb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784e0a8a1eee5571df2775586c7d3aeab67b387c8e58bed8938dbbe24a359da568b8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb48c72d2f86f620ad65b11564386290f64dddfed28cc93d977df34274aedf0c1d95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fb50330597511de5c536b657b86c73b5ae8d2960b8d67183364cac4a6691e4fd08a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206f4a941200000000000000000000000000000000000000000000000000000000007c6700000000000000000000000000000000000000000000000000000000000058375e031023c26ac0d597879d5eaf849bf16cbd33e9f77436012a6c703d267444c704597f59a5d014a1b06763966b222e9708bbd6e7ce9170f2f0fe5be3607126461b582193e72bb51f4c5919b453493c92679631e25fbdd825ce3a54544fefbe4f4685b557dfe179ee57a6b181f5efe1ae63dac8d006659eba585a602ddc27c0f7ddb37463b17a3dda355d81814e91fccbce4215506825f5407ff21debc1e633b7319c8246e7273b7a58dabc54d4c55d870fedfdb6fbc3fa7cd0b9f1e5b644bbe1f93d524b188f0e156703bd3cd944223e121a877166791ada0a8efe05fac76b5e4f786cbbd669b7ea409307e1322456d8036a99627e23ec0e8fd30568172f";
    const withdrawalCredentials = "0x020000000000000000000000eE45C342E7A183B1C2DEE96c7278aB3beCe36DEc"

    it("Should verify a 0x02 validator", async () => {
      const { beaconProofs } = fixture;

      await beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
    });
    it("Should verify a 0x01 validator", async () => {
      const { beaconProofs } = fixture;

      // From Hoodi validator 1222119
      const beaconRoot =
        "0xafdaf9d9572ee13f9a0d0cf4a41e3e6012dfd65642b1a2adab70a3503304bb51";
      const validatorIndex = 1222119;
      const publicKeyLeaf =
        "0x9763eab2448c08aaca5f3309aac635809691c3c51e41bd6afdf5c1a2b960a282";
      const proof =
        "0x010000000000000000000000d7466c5fd68774d70a5f1590f7b51f879e192d2019327cb9763c96e00332bde93bdbb1032c4b796dda73e515c8c5f7ede9a419be3249810276d8d8740fc8cc9187edd31ddeee92650ae636e7b87b36ed015e4498f1558b2ad3a8b43719b54ea1c16a6fb6455031dd3d169615b9098c7d51eca13d8d0e092750a9efd9cbab5e6b7f36d0fb1ea7624a1e13d5afcbf078734b94aacbc50c4a69d59c0d1b803b986e4fc5f7fe88ad30ab0054842a18e82ce91dd0c10a30cf6f7d10dac06ca475da79ac3dd034d74f55413112262bca97fc091abfb549a1fd9bc4b48745f98956231d71308eb89820d7b4136d2ce3e92dcbb2fbd453eab3df69ea687467eca1972c07a4314c13acf1529e9aca0273aa0f72ed4afd7a3b7b0abaf8bfbebbfec6996a92dce8ec5f0139780a995d7edbd97480e84736b1a843b0421133a61ce5f137f8fc2aa2882b4177c72d044ffd580e17b5774752149754f025bf8c4f60adf28efe8f33e8c2da1266922461c02db9b018a8f1c450c99854a7f7ee6154f5e7d46777334414d6d051a6682f2dcf5f13b42732340aeec38b99496cb9db22328cc11624f671eda45ee940cd2e0933131a63d73e14d87ccf3c496a2b0447926938f277865a197d26d90f39d78ddc929c37c940dbe7fa5f75feb7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5fffe7e8de8c00f93a9e2716d864b95761eb28b9fde8d0d358647ea6e34a3b3ebdb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784898a54911e092b561e5bb20162d9f9b783010e062d45af64756a83c8c5d361fd8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92bebf52959c496012ab1260bb313a49f054aa8a68f4a671c681964fc2458c3cbef5c95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17f40193653818402a3b9e2cc714f85b60e4ae6eb3b52c506536e4011141b5b81f58a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206fc9a81200000000000000000000000000000000000000000000000000000000007c67000000000000000000000000000000000000000000000000000000000000cc31bb7605a892a8e3a0774f3c3298f2f51e0a177d7cbab3cb05bb6a25b2753f493c36e4659b50251ebb083bcbefb1bacc1f81630d0e55049fb9e86600b79b39043b26951ef74da4c0cb5f1e1c4e5a2e429813edf762e51e7e4b4498c9404ecb5ff4bc3271625d63c5c56a9229856ce68d247a5ad43b8e18118a4e24121544687b0f5420f3432931918f1a395f499d3239333c301bb7d925c2b1041395e55e71a9f43bca28a11b8927de32393be7dfbf3255fe25576febfb181fb698f9ecf5ea6a7a12d251976a24713d32e6d23c486a56a4a55891b2121969107b21373f2dce75f0f9b7c815827cd54d4d53550351da9adb7dddba7687c49a6cfb11ef60efa6";
      const withdrawalCredentials = "0x010000000000000000000000d7466c5fd68774d70a5f1590f7b51f879e192d20";

      await beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
    });
    it("Fail to verify with zero beacon block root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot = ZERO_BYTES32;

      const tx = beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
      await expect(tx).to.be.revertedWith("Invalid block root");
    });
    it("Fail to verify with invalid beacon block root", async () => {
      const { beaconProofs } = fixture;

      // The last byte changes to aa
      const beaconRoot =
        "0xd33574842aabc553574750a093a4f5be40c79306de9915744f0fd297a3570eaa";

      const tx = beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
      await expect(tx).to.be.revertedWith("Invalid validator proof");
    });
    it("Fail to verify with zero padded proof", async () => {
      const { beaconProofs } = fixture;

      // The first 32 bytes is the withdrawal credential
      const proof =
        // The withdrawal credential
        "0x020000000000000000000000eE45C342E7A183B1C2DEE96c7278aB3beCe36DEc" +
        // pad the rest with zeros
        hexZeroPad("0x", 1696 - 32).slice(2);

      const tx = beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
      await expect(tx).to.be.revertedWith("Invalid validator proof");
    });
    it("Fail to verify with invalid withdrawal address", async () => {
      const { beaconProofs } = fixture;

      // The last byte changes to aa
      const withdrawalCredentials = "0x020000000000000000000000eE45C342E7A183B1C2DEE96c7278aB3beCe36Daa";

      const tx = beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
      await expect(tx).to.be.revertedWith("Invalid withdrawal cred");
    });
    it("Fail to verify when the validator type does not match", async () => {
      const { beaconProofs } = fixture;

      // The first 32 bytes is the withdrawal credential
      // The first byte is the validator type
      const proof =
        "0x010000000000000000000000ee45c342e7a183b1c2dee96c7278ab3bece36dec083d993e840e913d2cb98799d46c5631598dfbb681c1af772a0d5fb62a301f972c84ba62dc4e7011c24fb0878e3ef2245a9e2cf2cacbbaf2978a4efa4703728352499952dbcb7ec23c556afa297d7919adfac3e727b832082e95e1fee1d19e44f6f40a072763e2bae1d4c47043cd5f6baa3c7a87c5c3a0eb0a1393ed62d56ec15703728aef5ef6f1d1c944c0a70d1880cccb4ed3fa2c91a042b0be49d2614753e49bb4f1c98b96345f10bbf63ed989b1d9032f97727fee2340bed0f2776cd50a2cf2960f326cc55975be6d14ccd881987a6706c859801c11fc5ccb290cbc2303b705cc4e0702b73370ae7430fbf48d6c30b7b679004a73977d60b3f5035c884423a60780c5b128455a1e502031975ed0c11c460c4a8c1b16ec949e85f583569887eb0ddba57e35f6d286673802a4af5975e22506c7cf4c64bb6be5ee11527f2c26846476fd5fc54a5d43385167c95144f2643f533cc85bb9d16b782f8d7db193506d86582d252405b840018792cad2bf1259f1ef5aa5f887e13cb2f0094f51e14ff7d34eb2887de014b316054b5bbb11918f94a8c6d0b638ab632d23b93b82736cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220570206ba0152ca41d56df2e853d8e059e1f62bb761d8c61908c8caa177558d42df6af5f5bbdb6be9ef8aa618e4bf8073960867171e29676f8b284dea6a08a85eb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784e0a8a1eee5571df2775586c7d3aeab67b387c8e58bed8938dbbe24a359da568b8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb48c72d2f86f620ad65b11564386290f64dddfed28cc93d977df34274aedf0c1d95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fb50330597511de5c536b657b86c73b5ae8d2960b8d67183364cac4a6691e4fd08a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206f4a941200000000000000000000000000000000000000000000000000000000007c6700000000000000000000000000000000000000000000000000000000000058375e031023c26ac0d597879d5eaf849bf16cbd33e9f77436012a6c703d267444c704597f59a5d014a1b06763966b222e9708bbd6e7ce9170f2f0fe5be3607126461b582193e72bb51f4c5919b453493c92679631e25fbdd825ce3a54544fefbe4f4685b557dfe179ee57a6b181f5efe1ae63dac8d006659eba585a602ddc27c0f7ddb37463b17a3dda355d81814e91fccbce4215506825f5407ff21debc1e633b7319c8246e7273b7a58dabc54d4c55d870fedfdb6fbc3fa7cd0b9f1e5b644bbe1f93d524b188f0e156703bd3cd944223e121a877166791ada0a8efe05fac76b5e4f786cbbd669b7ea409307e1322456d8036a99627e23ec0e8fd30568172f";

      const tx = beaconProofs.verifyValidator(
        beaconRoot,
        publicKeyLeaf,
        proof,
        validatorIndex,
        withdrawalCredentials
      );
      await expect(tx).to.be.revertedWith("Invalid withdrawal cred");
    });
    const testPrefixes = [
      "0x021000000000000000000000",
      "0x020100000000000000000000",
      "0x020000000001000000000000",
      "0x020000000000000000000010",
      "0x020000000000000000000001",
    ];
    for (const prefix of testPrefixes) {
      it(`Fail to verify with withdrawal credential prefix ${prefix}`, async () => {
        const { beaconProofs } = fixture;

        // The first 32 bytes is the withdrawal credential
        const invalidProof = prefix + proof.slice(26);
        const tx = beaconProofs.verifyValidator(
          beaconRoot,
          publicKeyLeaf,
          invalidProof,
          validatorIndex,
          withdrawalCredentials
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawal cred");
      });
    }
  });
  describe("Validator withdrawable epoch to beacon block root proof", () => {
    describe("when validator is not exiting", () => {
      // From Ethereum slot 11788492
      const beaconRoot =
        "0xaa2b00b0ff536f96bacdb0f9d65055fb7b392d0d199a78719b5ef59225c7d7c6";
      const validatorIndex = 1930711;
      const withdrawableEpochProof =
        "0xffffffffffffffff000000000000000000000000000000000000000000000000448348fb3de1f630de0088ae5f4f7cc637944b9926153ed5e9cd877400aa2b114c5a65aee4cc28fcf63783832f80c412e509375be3ba9ec684bf9a6521f1524764024e0c64b2b3400504452ad10993b85a56c9447b0ae493470d44982a7da9353d3ff165c7c848dc4886b59f724cf42046cb9aae7bb4b58770fca3dd309e266c9684fa8eb4cbb72745a94a31923adb83bb9c9130c60043109a3e1b55e30f644c1490a7f0e048ff84548d7c7b785df5b891cebd18388cc5b21dcea995406a24c6d468d09e7792768eacfdf116ac5fd2d72be9d8303f360c30c120919f160b039b8f834a9a54e91c5da223eff8dcab81ee2c477e6cd84b089fbd7fe117faeeb0402b1b8084eec7221f94e537ac8b13bdcb87b52fad38f68d35f6824a155faeb92f49f9a4f93b759f9291605eba7af6d3d04587c99048f52c2144cc195e47597e383d4f8408914e612579596f3001ed8ebc7ccf5559dcfbb0268faac82d8d6401f20b43882f90e6e661d695db8317927af748f6674f34eef20496b597622be20a8e967635f6b34b6b9742bbacff77945ec52ea7b6169428f412d400ed6bb772267b6cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa7596422019958f9a01eea80eb3c7af7bdb3e39c3fd97adb79027cc502d6c37dcf7da4549106d1b68ae3c5841c8ffe7cd30a77dec511669b38672e1478a3c1a158d20ba0552fda64b407397d1dfc5ada264d276349e900a8f5efd0ecf0356c6247cfe0922d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb94e9c3619c5d0176371eca00aed8f3bf4b91b9fc083c3c23ea3752295b5db5358d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603aba6cb95a7a65e7c61ca91957ace0a04fdc832ece50802c801f9b86a16cefd6c02c103b3c5a08e39d67b65a11f525842835f27347e678060db94b47ebe4bd2b01039daf4b3328d22c2e0645d19af3fe53f0a6dc3b9c929858ff0bcda67fc410dc18a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206fdd761d0000000000000000000000000000000000000000000000000000000000c6341f00000000000000000000000000000000000000000000000000000000004dbb0c24e67a45529b8c7691c5ddcfeb32f3065bf806d9fffd151874e3d93089345bff33be172965d48003555d3de200bf32a79f892b7c47b3169949a4829a841b89b71ff7ab35e4dffc58187339aa1cf8acac069061533cd5d7ded71f54a1dd86cca3a3e76509c80dda9845e63b93be7993d1ea76ab8ee56af58cdabeae946152a8f7fe45f58fd177ac5eb68f74c4641a38a65b5cec9cda9257b7aacf9b80d25d281c85a81e960ec64b2b8f41bc341430fc5b3e0f9875da38a8094d2caa308dbf3e9a950bac1c2c3948d6109a4a99ee10c83d6aeae3c84239be363c9dd78c83851e04afb73b0aa7e834efc40c6e496ebabc958977ed72a273e76e106a68f735";
      const withdrawableEpoch = MAX_UINT64;
      it("Should verify", async () => {
        const { beaconProofs } = fixture;

        await beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
      });
      it("Fail to verify with zero beacon block root", async () => {
        const { beaconProofs } = fixture;

        const beaconRoot = ZERO_BYTES32;

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid block root");
      });
      it("Fail to verify with invalid block root", async () => {
        const { beaconProofs } = fixture;

        // First bytes changes to 00
        const beaconRoot =
          "0x002b00b0ff536f96bacdb0f9d65055fb7b392d0d199a78719b5ef59225c7d7c6";

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawable proof");
      });
      it("Fail to verify with invalid validator index", async () => {
        const { beaconProofs } = fixture;

        const invalidValidatorIndex = validatorIndex + 1;

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          invalidValidatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawable proof");
      });
      it("Fail to verify with invalid withdrawable epoch", async () => {
        const { beaconProofs } = fixture;

        const withdrawableEpoch = 0;

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawable proof");
      });
      it("Fail to verify with zero padded withdrawable epoch proof", async () => {
        const { beaconProofs } = fixture;

        const withdrawableEpochProof = hexZeroPad("0x", 1696);

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawable proof");
      });
    });
    describe("when validator is exiting", () => {
      // From Hoodi slot 1062956
      const beaconRoot =
        "0xe67d0075baad5f0cfb93f8997101c73d045d2e258df0e20acd88a595e185c0bc";
      const validatorIndex = 1187281;
      const withdrawableEpochProof =
        "0xd274000000000000000000000000000000000000000000000000000000000000bcf5e1a2a4374aa96ef475a13410a1c39f9295ab2a42f5cd11afa5a40e35fa037f8bcd9996e785306d0a6a8cdbe092738c68f753b4fc412eac99de8b490c2d214c5e91487ad09c68b3ae7530bfc7b66db25f97bf5629aba7296268d5713359244b93d604e56318360c94e82a2d9e75ac719afb14cc31ad2dccea695cccd9dc147dd9b1f904d8f1740ee2b8fb72a1a16bcf296d8e7671e8ea0e6e4d16c62b79eb5f565f229f79c29a48a498df066104a12ab9135b3ed93038be19d276f6e6006d362f5f8b4b8565b347a08e9033d45eff0ee5798752694a3a2c84cb49df253bee5875fe2899f1263f4878fe6e195e4e572f7a6f8f29e08a1a38bc3a46bad28ebaf02782a4eee9fe6b708d01e4ad1c0a0a3ca5a9f36154140f515aede8ad967e45029fb8110aa3a7474c31895b274a1b829b1af9ee86fb089bda2589924b66e828ed2ada927524c831b65e592ab4d3ba2f4cb0f0cf03c12064be16e8bc6b7daa8a574ce484c0fa6165947e36f8019c81831c3de54e3937705f664ea85d66706576b4f46b9c0d75e37a0ca43f026a6e953c3fd56a099436a7ebdf1b1ca563875527bc32420f5cae1e64ec44f63e84cee47c9254447472483a58fc72542b9f43be2786bc9df664de2511916272fb577c28bc77c3a2ce2b433ef6047a01bd62583711a50330fc0a8524826117f2e9a24e2a20281205736a094be45b1534dc73de458f668eed8a60bdb485e0d45a37e2d4461939de5e74a2a96699a6159c432a4dbb79d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92bebb9537ad12c4d2d8a2700650f81ea6a53a84a027363fc6bebce014f8f16da706495eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fc1e28efda3442aff519e3ddf848524f4702e736abe56801ac815ac3b2d0116e68a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206fc96f1200000000000000000000000000000000000000000000000000000000007c6700000000000000000000000000000000000000000000000000000000000059b78aabc3077279caa08a4d1ad4c95eb6b8b2cbb7d778d240ae29ea9889ca3eb50e24f3fb24980544b1b30b03f1d78b30f43873d5cc72d27efcc1ba2a290e31861a5917b8703ffefe09a9f77c1d658dbd26403528479cee506813e56d6cb0c0c885bf02745bd7eda7e3b5cfb5edf4fdf606df6c59402050ff3aead560d732097aafa84e1a3de050902f575c12c2db446526ffe92da401ff9012a307bdd1d649b6468ba2f1178ddd2aaa02c5b32c1723b426fc24cb9f8421363ca7fbdb02e5e33005877d3386aba9b3c3f90fc31d6fb0e30d958f3997b31a4c80865bce70eca497efaf27b7a534d1a2e820520ec9aa52a8e87c24031f3bd637fab00553653ae3";
      const withdrawableEpoch = 30162;

      it("Should verify", async () => {
        const { beaconProofs } = fixture;

        await beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          withdrawableEpoch,
          withdrawableEpochProof
        );
      });
      it("Fail to verify with invalid withdrawable epoch", async () => {
        const { beaconProofs } = fixture;

        const invalidWithdrawableEpoch = withdrawableEpoch + 1;

        let tx = beaconProofs.verifyValidatorWithdrawable(
          beaconRoot,
          validatorIndex,
          invalidWithdrawableEpoch,
          withdrawableEpochProof
        );
        await expect(tx).to.be.revertedWith("Invalid withdrawable proof");
      });
    });
  });
  describe("Pending deposit container to beacon block root proof", () => {
    const beaconRoot =
      "0x43012e41c2314bd2ad884d1e8b647f26fa49079615fd8a288aab302a4125eaa3";
    const pendingDepositContainerLeaf =
      "0x29f5ff53b711973c7502fc210c7c820f80b3ece5ac4d5afe7b0281aa940d42b3";
    const proof =
      "0x3143c5375c2ff81ac5898cd4951ca273234352195550f0640aba71184b55fdb995e66eb7fedfd7ade2566fc840c18692c4ecc458d52736b6ceed120ebb27d2111ae5deb8a5bf73487bce2069c7586f14404ed4a25c4ed660cb2acfc06731557ec78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c00404d4f2ddbe53d5deb282d04fcc31925fa6761e574b77555f004651b5429a217c7bbd7e3314490a2629fa266fb5504a943731d1ea5d582286ff7659fc68bf64565ffb1f673c0f1fcbd5dd78852ec34fa6e2b9975c4f8676ebbf0ddb0b7a117b800828e1f257df17b9d39f79762fd92197ac859c582e8a3326f5962fed90975";

    it("Should verify", async () => {
      const { beaconProofs } = fixture;

      await beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        pendingDepositContainerLeaf,
        proof
      );
    });
    it("Fail to verify with zero beacon block root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot = ZERO_BYTES32;

      const tx = beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        pendingDepositContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid block root");
    });
    it("Fail to verify with invalid beacon block root", async () => {
      const { beaconProofs } = fixture;

      // The last byte is changed to bb
      const beaconRoot =
        "0x43012e41c2314bd2ad884d1e8b647f26fa49079615fd8a288aab302a4125eabb";

      const tx = beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        pendingDepositContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid deposit container proof");
    });
    it("Fail to verify with zero padded proof", async () => {
      const { beaconProofs } = fixture;

      const proof = hexZeroPad("0x", 288);

      const tx = beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        pendingDepositContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid deposit container proof");
    });
    it("Fail to verify with invalid proof", async () => {
      const { beaconProofs } = fixture;

      // Changed the first byte to aa
      const proof =
        "0x3143c5375c2ff81ac5898cd4951ca273234352195550f0640aba71184b55fdb995e66eb7fedfd7ade2566fc840c18692c4ecc458d52736b6ceed120ebb27d2111ae5deb8a5bf73487bce2069c7586f14404ed4a25c4ed660cb2acfc06731557ec78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c00404d4f2ddbe53d5deb282d04fcc31925fa6761e574b77555f004651b5429a217c7bbd7e3314490a2629fa266fb5504a943731d1ea5d582286ff7659fc68bf64565ffb1f673c0f1fcbd5dd78852ec34fa6e2b9975c4f8676ebbf0ddb0b7a117b800828e1f257df17b9d39f79762fd92197ac859c582e8a3326f5962fed909aa";

      const tx = beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        pendingDepositContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid deposit container proof");
    });
    it("Fail to verify with invalid pending deposit container root", async () => {
      const { beaconProofs } = fixture;

      // Changed the first bytes to aa
      const invalidPendingDepositContainerLeaf =
        "0x29f5ff53b711973c7502fc210c7c820f80b3ece5ac4d5afe7b0281aa940d42aa";

      const tx = beaconProofs.verifyPendingDepositsContainer(
        beaconRoot,
        invalidPendingDepositContainerLeaf,
        proof
      );
      await expect(tx).to.be.revertedWith("Invalid deposit container proof");
    });
  });
  describe("Pending deposit in pending deposit container proof", () => {
    const pendingDepositsContainerRoot =
      "0x29f5ff53b711973c7502fc210c7c820f80b3ece5ac4d5afe7b0281aa940d42b3";
    const depositIndex = 2;
    const pendingDepositRoot =
      "0x4dfe73a7c86302a851cd480b6b7172d32b24b2f7009bae5596137957257b1c8b";
    const proof =
      "0x6fe027418339b44e486f12ca438ce8de6e2f418bf1aaec5971a171fe346c973e0d9ecc366daa3b2a6eee463c6d8094704724c700ced65cbedb77b1fb9a792ea47804dedf885666be91d10c060f63ab1b9f91e8960d3a04225ed738a471cfb9d4a50a6da2319d690eb00f79e2c9a186fbea24cce1ac4928efc63b91b510596f4f5cea5a2e0fdfcb562fd698797a41dc61bf4fab2966c6b2c733c3f8322bd74348c98697ea70c28039f19102d11523fb4de439dcfb87e708e4032e313ffc8cc5697e87f523cac962071ec232257ac26569cae4072a16802b766e4ef56113ca08c86bc8fa34142fa26b430c68f0c3a04566af0816f3283040f029cd1cadae6f86d15229599ade1dbdfccff506fb7afc2e4c85948eed0aa7301a82a83fdf29391213101fe7baa4130773e7d9ac4c33a31aa729a5840be3e06492f934b636027191faa0bd1d43e76578d1d9e4e6ebf5d1603809545f172d5ea7428255001a71ecc170602dbb58d5b6771620a08370061216184a8d5ea3f9562249ead84ade7c6ceccd7cfb59e768724e262d00f8e5ff198172e452908b24f4febaa648edce62942a1532db53b558d2014fe69b564cc0387f844254225c8d0224c5c7e99a1d7722406fb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467650a2a000000000000000000000000000000000000000000000000000000000000";

    it("Should verify", async () => {
      const { beaconProofs } = fixture;

      await beaconProofs.verifyPendingDeposit(
        pendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        depositIndex
      );
    });
    it("Fail to verify with incorrect pending deposit root", async () => {
      const { beaconProofs } = fixture;

      // Changed the last byte to aa
      const invalidPendingDepositRoot =
        "0x4dfe73a7c86302a851cd480b6b7172d32b24b2f7009bae5596137957257b1caa";

      const tx = beaconProofs.verifyPendingDeposit(
        pendingDepositsContainerRoot,
        invalidPendingDepositRoot,
        proof,
        depositIndex
      );
      await expect(tx).to.be.revertedWith("Invalid deposit proof");
    });
    it("Fail to verify with zero container root", async () => {
      const { beaconProofs } = fixture;

      const invalidPendingDepositsContainerRoot = ZERO_BYTES32;

      const tx = beaconProofs.verifyPendingDeposit(
        invalidPendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        depositIndex
      );
      await expect(tx).to.be.revertedWith("Invalid root");
    });
    it("Fail to verify with incorrect container root", async () => {
      const { beaconProofs } = fixture;

      // Changed the last byte to aa
      const invalidPendingDepositsContainerRoot =
        "0x29f5ff53b711973c7502fc210c7c820f80b3ece5ac4d5afe7b0281aa940d42aa";

      const tx = beaconProofs.verifyPendingDeposit(
        invalidPendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        depositIndex
      );
      await expect(tx).to.be.revertedWith("Invalid deposit proof");
    });
    it("Fail to verify with zero padded proof", async () => {
      const { beaconProofs } = fixture;

      const proof = hexZeroPad("0x", 1248);

      const tx = beaconProofs.verifyPendingDeposit(
        pendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        depositIndex
      );
      await expect(tx).to.be.revertedWith("Invalid deposit proof");
    });
    it("Fail to verify with invalid deposit index", async () => {
      const { beaconProofs } = fixture;

      const invalidDepositIndex = depositIndex + 1;

      const tx = beaconProofs.verifyPendingDeposit(
        pendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        invalidDepositIndex
      );
      await expect(tx).to.be.revertedWith("Invalid deposit proof");
    });
    it("Fail to verify a pending deposit index that is too big", async () => {
      const { beaconProofs } = fixture;

      const pendingDepositIndexTooBig = BigNumber.from(2).pow(27);

      const tx = beaconProofs.verifyPendingDeposit(
        pendingDepositsContainerRoot,
        pendingDepositRoot,
        proof,
        pendingDepositIndexTooBig
      );
      await expect(tx).to.be.revertedWith("Invalid deposit index");
    });
  });
  describe("First pending deposit to beacon block root proof", () => {
    describe("for verifyDeposit which only checks the deposit slot", () => {
      describe("with pending deposit", () => {
        // Example is from Ethereum slot 11787450
        const beaconRoot =
          "0xa5415fb0e0983887b72f43ce3d8efd1963790e1405f56f423e6bdda923ca3923";
        // The slot of the first pending deposit
        const slot = 17043450;
        // The proof of the first pending deposit's public key
        const proof =
          "0x0000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4bdc4e0f397dfe60f10c7d1c9a198e071f5b035eabb9e8830627ffbee3feed7fcb3b7d47a8dc0679cef80387a199d3dfd80f88bd28a6f7e5faf86727d0c0eaa60f5965e4b5ed84eca8c4631abcbe2e7dcdb1c113eddab16db4ffd6e681a5c04862f84aab13a65766f9bfd3986f314c2bb295a0d7e5164df25942f3eaea9b23610154d2a221d0042bbf0b0ac737652d7e3f24944f95ebaaf61e01772ff8fa8364805cae429d6cd53dfe6a6aaa3b7c3c20a50a5ac79c6f5f45d23d092007600daa0b335be9d7fb7fa0cb9bff2829c0b12024b800825642c34599fb7635b6f077019d2db831bcf9018a14220a0a2b14d3c698e8bf550d797387529035135fe598e530d991993693ea28319c312e9d14925e3fbdf545ea4de402dd04ba7f45ff936f37a0e1bb63436d0dfa84ac1c9056c23b8da7a04f2963fac189edbb9721ee1a38a1926abe4a8de6725131a92f2bed3681545a5145bf676e465fcfb4f80f5f3f1764ffff0ad7e659772f9534c195c815efc4014ef1e1daed4404c06385d11192e92b6cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220b7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5fdf6af5f5bbdb6be9ef8aa618e4bf8073960867171e29676f8b284dea6a08a85eb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a46765a003000000000000000000000000000000000000000000000000000000000000caa54f8693175f58ca1a359dfa10592d68316fbdbd6bd9959c6cfae391b3a58021c31acb067ec9840693a9258cb460696dda1452cc8e096b3d2c830fea9242e616dc8ff3b420eecaa31fb1c77e66785d2d9513353df79fbec890dd2f20c0038ac78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c9d23bdb299c03957c0f9cbe012fdd9dec47cc34aa7a1d889fd31f29c08ab5835bf78426cad74f39a544240e1660589b2d313e8844d2732f9bd01147a9d80fea6ea96575b44df85fcfe4245a27e904ee82ccfd0ba6a23fb8f15b364a8f65d073f56c6c9b43ceec1e1bd8b4fe32e1b90969bed029efbaca61efd0e0788bd8fab48";

        it("Should verify", async () => {
          const { beaconProofs } = fixture;

          const isEmpty = await beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          expect(isEmpty).to.be.false;
        });
        it("Fail to verify with zero beacon block root", async () => {
          const { beaconProofs } = fixture;

          const beaconRoot = ZERO_BYTES32;

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid block root");
        });
        it("Fail to verify with invalid beacon block root", async () => {
          const { beaconProofs } = fixture;

          // Last byte changed to aa
          const beaconRoot =
            "0xc1825a2e9c8f353cbedee68dc636854c60f08962b6b246507183f9520dcc04aa";

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid deposit slot proof");
        });
        it("Fail to verify with zero padded proof", async () => {
          const { beaconProofs } = fixture;

          const proof = hexZeroPad("0x", 1280);

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid deposit slot proof");
        });
        it("Fail to verify with incorrect slot", async () => {
          const { beaconProofs } = fixture;

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot + 1,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid deposit slot proof");
        });
      });
      describe("with no pending deposit", () => {
        // From Hoodi slot 1015023
        const beaconRoot =
          "0x936a7ac91224df0522e8fc70521b604b025d37504a432ca9ea842a018ba7546c";
        const slot = 0;
        const proof =
          "0x0000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4bdb56114e00fdd4c1f85c892bf35ac9a89289aaecb1ebd0a96cde606a748b5d71c78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c9efde052aa15429fae05bad4d0b1d7c64da64d03d7a1854a588c2cb8430c0d30d88ddfeed400a8755596b21942c1497e114c302e6118290f91e6772976041fa187eb0ddba57e35f6d286673802a4af5975e22506c7cf4c64bb6be5ee11527f2c26846476fd5fc54a5d43385167c95144f2643f533cc85bb9d16b782f8d7db193506d86582d252405b840018792cad2bf1259f1ef5aa5f887e13cb2f0094f51e1ffff0ad7e659772f9534c195c815efc4014ef1e1daed4404c06385d11192e92b6cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220b7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5fdf6af5f5bbdb6be9ef8aa618e4bf8073960867171e29676f8b284dea6a08a85eb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467650000000000000000000000000000000000000000000000000000000000000000049c9edd0970b512318fe4a7d9ff12b2b1402164d872e40948fc7d9042ae6fa615433386cfe4fc95585fb6eeb51df3a6f619db3b3955884f7e5a2c4600ed2d47dae6d9c51743d5d9263bf2bd09c1db3bd529965d7ee7857643c919c6b696004ec78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123ceb818784738117ef339dce506dc4996cecd38ef7ed6021eb0b4382bf9c3e81b3cce9d380b4759b9c6277871c289b42feed13f46b29b78c3be52296492ef902aecd1fa730ef94dfb6efa48a62de660970894608c2e16cce90ef2b3880778f8e383e09791016e57e609c54db8d85e1e0607a528e23b6c34dc738f899f2c284d765";

        it("Should verify with zero slot", async () => {
          const { beaconProofs } = fixture;

          const isEmpty = await beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          expect(isEmpty).to.be.true;
        });
        it("Should verify with non-zero slot", async () => {
          const { beaconProofs } = fixture;

          const slot = 12345678; // Arbitrary non-zero slot
          const isEmpty = await beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          expect(isEmpty).to.be.true;
        });
        it("Fail to verify with zero beacon root", async () => {
          const { beaconProofs } = fixture;

          const beaconRoot = ZERO_BYTES32;

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid block root");
        });
        it("Fail to verify with invalid beacon root", async () => {
          const { beaconProofs } = fixture;
          // First byte changed to aa
          const beaconRoot =
            "0xaa6a7ac91224df0522e8fc70521b604b025d37504a432ca9ea842a018ba7546c";

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid empty deposits proof");
        });
        it("Fail to verify with zero padded proof", async () => {
          const { beaconProofs } = fixture;

          const proof = hexZeroPad("0x", 1184);

          const tx = beaconProofs.verifyFirstPendingDeposit(
            beaconRoot,
            slot,
            proof
          );
          await expect(tx).to.be.revertedWith("Invalid empty deposits proof");
        });
      });
    });
  });
});
