const { expect } = require("chai");

const { beaconChainFixture } = require("../_fixture");
const { formatUnits } = require("ethers/lib/utils");

describe("Beacon chain proofs", async () => {
  let fixture;
  beforeEach(async () => {
    fixture = await beaconChainFixture();
  });
  describe("Generalized index", () => {
    it("from height and index", async () => {
      const { beaconProofs } = fixture;
      expect(await beaconProofs.generalizeIndexSingle(0, 0)).eq(1);
      expect(await beaconProofs.generalizeIndexSingle(1, 0)).eq(2);
      expect(await beaconProofs.generalizeIndexSingle(1, 1)).eq(3);
      expect(await beaconProofs.generalizeIndexSingle(2, 0)).eq(4);
      expect(await beaconProofs.generalizeIndexSingle(2, 3)).eq(7);
      expect(await beaconProofs.generalizeIndexSingle(3, 0)).eq(8);
      expect(await beaconProofs.generalizeIndexSingle(3, 1)).eq(9);
      expect(await beaconProofs.generalizeIndexSingle(3, 2)).eq(10);
      expect(await beaconProofs.generalizeIndexSingle(3, 6)).eq(14);
      expect(await beaconProofs.generalizeIndexSingle(3, 7)).eq(15);
      expect(await beaconProofs.generalizeIndexSingle(6, 12)).eq(76);
    });
    it("BeaconBlock.slot", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 0,
          },
        ])
      ).eq(8);
    });
    it("BeaconBlock.parentRoot", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 2,
          },
        ])
      ).eq(10);
    });
    it("BeaconBlock.body", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
        ])
      ).eq(12);
    });
    it("BeaconBlock.BeaconBlockBody.randaoReveal", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
          {
            height: 4,
            index: 0,
          },
        ])
      ).eq(192);
    });
    it("BeaconBlock.BeaconState.balances", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 3,
          },
          {
            height: 6,
            index: 12,
          },
        ])
      ).eq(716);
    });
    it("BeaconBlock.body.executionPayload.blockNumber", async () => {
      const { beaconProofs } = fixture;

      expect(
        await await beaconProofs.generalizeIndex([
          {
            height: 3,
            index: 4,
          },
          {
            height: 4,
            index: 9,
          },
          {
            height: 5,
            index: 6,
          },
        ])
      ).eq(6438);
    });
  });
  describe("verify", () => {
    it("slot to beacon root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot =
        "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b0474";
      const slot = 11952064;
      const proof =
        "0x664c1200000000000000000000000000000000000000000000000000000000002246ef8566d87c91d34795476ac71bfe163b817b6217767107a9179056d8f3bf71c990856b4ce5cd0c635561d221a760c5be68a43c7a26b82c92800a16e05ddc";

      await beaconProofs.verifySlot(beaconRoot, slot, proof);
    });
    it("block number to beacon root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot =
        "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b0474";
      const block = 22731293;
      const proof =
        "0x005125020000000000000000000000000000000000000000000000000000000014fd5ec25073d92da921cef1c89fbacd22808b2a86b1f7900b3d47e3678fd5fbbfa78c355af9439fdf85a40ac6c0d4c590f5632d79524bd86c1cbe32131b437ce683834cdb8308a714a5bdb210af255c4addfd2a95164b72e4ba6e2197cd50e6536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c3fd84ada359bf655da35554801a25e17b9936836d096553deff04d8365104f76b9cfda6b647d5a680e98b9739378a44744bfe3b3ed6d1a8808d35e67b5aa59e76dd3b9955d892d92338b19976fd07084bfe88a76c3063482b7f30ee60feb2a587c53c4343aa11f1f09eb7b6d3c2c9f9c126d02e8fb13540acf5cbfd231514a460000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b7b21c6bd63f6d1c4ebf029cc52bc5519811d5017f54679a303230b9b6ab18b80";

      await beaconProofs.verifyBlockNumber(beaconRoot, block, proof);
    });
    it("balances container to beacon root", async () => {
      const { beaconProofs } = fixture;

      const beaconRoot =
        "0x5afbdb19dd02b8d6bf10ee1722753b4a687326f1e7c3a4515ec47be3599b0474";
      const balancesContainerLeaf =
        "0xa4181bd72c96848c06c64a28ce7c21563b6063f289ec27d2b5f05aae4dfdb57d";
      const proof =
        "0x4938a396a5a5651cdeab2dbc058f866ebcda5fd4fc85a152f22dba474c009791732bb29b9703de0515129d79481b879a3dd9123eeffe7bf8afd4aaff84378560ab5cfe225d99d908dd717ced212090862faf3d42ef6d49b90e5a3d53a13a187ba1ba6d4a2373a34ace4c3bdff56faaf6dc7e93b538bab62355581ae2b679cf30b9db93bd03ab076a7c7dce90b2fcd3162c71977e7e58a31e1ca4a0dded313be333f54b1fbc27a269a843a4d3838e0013984cc884b7a88e4d7f528a1c9a76c98c41dd7ebb8c56a217d6881589c4e09ce0055bea097be50e2dcaa07757da3df8bb1561936559cd736ba1d1802b048e118c414a17c48ff04189f0b8df768d599c9171c990856b4ce5cd0c635561d221a760c5be68a43c7a26b82c92800a16e05ddc";

      await beaconProofs.verifyBalancesContainer(
        beaconRoot,
        balancesContainerLeaf,
        proof
      );
    });
    it("Validator balance to balances container root", async () => {
      const { beaconProofs } = fixture;

      const balancesRoot =
        "0xd33574842aabc553574750a093a4f5be40c79306de9915744f0fd297a3570e6e";
      const validatorIndex = 1770193;
      const balanceLeaf =
        "0x0000000000000000f5b87473070000000000000000000000dd06757307000000";
      const proof =
        "0xe882747307000000b3ae74730700000022fe7473070000000000000000000000a0e70a60b292ba301171cec7c6fc2cbab7f3bf8f0dffe2cae5eaef133d3882f8868061031e7c19c701169dba0ff8f8a16652b144b1601012aef58da66aede34f31f54712eae171f1d7115be3e615f0987382f783a846ae438a894398c615efd1cc013d1c8bf5292755492ec4672e7c4a46e680a863f85d6de9ea59412f19c5350e7ee4a0132b26adb417f5d668ee4ec6311fa6552a3f2de928a9df72946fddf09dd9e3994b879b7de86f47c5f5178e3371493dee98b9c5830a9887fda366dea4c7ead58860119d8156dd5a3eb5251eb92dfe2d9c16d3c13cea6910f66af979f2333359c758ba132cb875a4ab011c5e2997f9a9d5d055babf64822b1aca2e13f1bf325f10a9ee255ff13647c4a6237ed79411f5f3fe148c0d7dafbcaae467da03027c76f6fadae20f8aa378b9e297c02d5bf0f557287613cfa049e22ec8c8980ec970e9372314604a5d1d561c967f76f072942c82c126a872ee804848a850ecd282ea91cfb0f1785b6d9cfdf6cddd0694466023e232ee9c8d9fdf264f5ef130fba42247e45be5fed39f7738913901f0659a4b28f5f8161bf82af82b6a094cfc89fa921156f8d23ae5ff5a27b3a362bab64ba53cd6ba38757f94bf3b93542f2852662b715121ee217b0832c95ee45923102b3d39f76bf11dadd2474de2bcd6611c1973c323c3046a54b239454b99a78a8af5e881d601e29e39d98ed70b36fa061cd2fc5311499e6939e2ba3737e47d319dfbcf370deee1c9cac017b945f88eb211f956a065b2ce0f0597ad85e4779af2b74ec8b1d0099b2f71356abaec97644f25f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a7476b51d0000000000000000000000000000000000000000000000000000000000";

      const balance = await beaconProofs.verifyValidatorBalance(
        balancesRoot,
        balanceLeaf,
        proof,
        validatorIndex
      );
      console.log("balance", formatUnits(balance, 9));
      expect(balance).to.eq("32001800437");
    });
    it("Validator public key to beacon block root", async () => {
      const { beaconProofs } = fixture;

      const balancesRoot =
        "0xd33574842aabc553574750a093a4f5be40c79306de9915744f0fd297a3570e6e";
      const validatorIndex = 1770193;
      const publicKeyLeaf =
        "0x54a218cedc2dd9249322cec9e8a2f721c2e53e0b7ee5d631f3c277b08acc89ff";
      const proof =
        "0x01000000000000000000000071d06f6bb8f2cdaca28c055ebfeea4eb3740955119327cb9763c96e00332bde93bdbb1032c4b796dda73e515c8c5f7ede9a419bed668ab4a931aeb2dc6b9d7a953819e3b2b7db5959d352cfd0b282f1907f273c33b3f028cee8ee43c25380f79a3cbf695aaf47ec1cb7940b1e57dfc02152b4ac594e72aabe6eef554ad751437689924380eda5fdc528a569bdc4ededc56aa673f88582bd349960667b5a8b92deade4ac0cc0ca5c6d0b229694832bfb445d65a5e32bc5c9c8ac4de6ef484dcc74dbdd395b03b371f590ad21adf060462fa445d2f90bac67740b67f24878c8aa088bb3db6bd1e5db16d2e4e7c4dd945c8e7fbd5ba2a87a5b3f71839975addaef00652ee0c029ca7f3934ca7d17fe44fcc4713c6d2a6c33af061a2cfcb7e17860c09e3138e392b3d1ebc1fe3c6f83fd27f748ea72efad920bbbdad67d891c9f86dbbdf33b269a618d17f5474e56d384bece8ac9df38a159473e143ba377e1a8dcf920a8f660cdcf8dd3b1c614ec4a445d4da3315848c18e078743449ec54c4042aad00fc57f43da63301288e6cded661020325eeb5f085847d258a4d09acb22016bc2e17a1693765496cd06203c0125caf43ba9cc72fb54bc24ff218ead202e99e80f064546398a4364c64fb18965c5e375e91575d988e3bf7414562135e24a15fc2ed1cf5c22eb007e36a95a8b6eab26bdcb4f5289015c27c4c9fa2d5bf133a5d1ffc30ae6acc0edd3cc444f204d8781bfdd91a380cfffd9d6e84268bd5c3c80de459a5cea47a61263a5b781892b40f4667ff06265914c95f1cd42fbe6f6cdc46163ae1e63075ffef7966c4c4c05310ba4704bf9c383e183d34206472066e1ef7f68faf8560bdbf52d1de5fda1e1f68bda4aaf6b51cdc4c604905ecc4a6fcb79ccc532a97d0e91d7108f37d96580e3423d7da47e3dc013479d21f4d65b88762a156b2901de33116f246f4ea21fb87597005f1438ab2c9558c49a6c4d0dbc99d6b5fc32b5ee17c3d56e38eba87e0acfac6e45ffb4e9908596d28c2a81e678287b84cc6ffdd6ed1e8c82f72965bab073827ac3fe6238a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206f76b51d0000000000000000000000000000000000000000000000000000000000c6341f00000000000000000000000000000000000000000000000000000000004400e4a84a1446200c33de846baaf10b6c305c9a5fbb806f1f4239734a2993d3b67c50ea0a5f1e5ff3eccaeca13a74e6feafa7fe962d7fdcaa490d923e34199d50c40233e7bf3a27a9f06268e59c5e121cef1f7f7368edda100e8b39af9d2d378bb80f679da5b680f3596b143f0dbe3f65f105ceaeae3f9bbc1f96b51e4969fbb611c79b6b930d8588fc3cd2aac97695e422b49c87256def4015349f3234090e871c9ff223bdc9004aded09ef020f377a4783d963295aba48226e94f5feb192227a5c480a27409d02990714b6b5ee7331dd081479169780cf13d4ff832b927fd5bd50bf12101bf4a09f7e1c69f675e8b72cb60addebe2fec963bbdd0d7b64197";

      await beaconProofs.verifyValidatorPubkey(
        balancesRoot,
        publicKeyLeaf,
        proof,
        validatorIndex
      );
    });
  });
});
