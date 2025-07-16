const { expect } = require("chai");
const { network } = require("hardhat");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers").utils;
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
  createFixtureLoader,
  compoundingStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(compoundingStakingSSVStrategyFixture);

const testValidators = [
  {
    // register tx 0x33258f692fe9f5cb697918d2acb0beb634142f08efd02014bf345d14eb01b0f9
    // deposit tx 0x6bee31cbe395435fac4b9632ef718f6cf6f938a48d417d05bb96502fa588cf2d
    publicKey:
      "0xb3aad1f5a7b6bfbcd81b75f8a60e6e54cc64fbf09cb05a46f92bab8c6c017106d643d1de70027b5d30fa943b9207c543",
    publicKeyHash:
      "0xb1d3e454498123d8069f9138420c9a422fab4bf97f9786849b0d7daddb359f47",
    index: 1930685,
    operatorIds: [424, 425, 426, 427],
    sharesData:
      "0xa819d1092f8c335cf85d318e9b6a4d82934190294c4a687a92ddb6cb9cd8ce3eee64676b899854535e34af10bd3575291077bb8617ed84424f80608a76664771129aea2f7a7cfcd390a6db04e87dfaefb170f057a2404210b04d1e1c0e1e9b4f886cef456a3dad1da1ac67a2976c59fe8cdb8442de60d70164ca8816dc69037a76a0ba7c06db9e954c67eadab7a4b5bdade0f92bc67ce24ef3e2a81141282124b8f00687fbf322604687b6eab9f62bdd23886c0418eb76878ffd49c26101b931a9dc12231d601a80aec054c382977168109863c1dfb477de7f32836a1d3ef53f76fe8c7c4c5ca79d8bd0194c30807f35b62fa199237b1ec2ad9f73a26a8dd561a6c9fd88b90a64a6a6e9e7c2a0401def70dd3858300366cbe1bcaec5fa8c009e57fe9150a98733ecc843d2c92f839ab31f9b73ee489ea059aff2c1576a8ae81a4db45ef417b07d640dea3fd1f70c279433a78044664e96d36c1fb7851166e601c42af2e9d7a8b7adeffd62a6e7cea8fb8de1610991b63609f833d5c7e2272c7caf07cd49645bf0d059a1f8b7b749b51b044de99df6511d378af6a72503ddb141344bb608c56965060d7d5d6bc6acb642a8b629f7997a5ebc1e6173acc538299acbd500686a0898ba6e33474fcef7f563dec872a5147b6cf13a0e86b4f8e3232698f24f429e9dfd6541bdd8be4e73d216740481ea08a77619fbc6cfc22bda7c43283d8b1057cb1cd66024735e739b875e55d5fcb5dd988dbfe9b2b2196f93d586643ba5642e2d486acb8a841e3901c53676e59ed6562ac0ea23d2e0f395bfbc12f75500352252d20178428df1799cda8c58b423a6c301549cbf75bffe97d1dd8d4ca9ef217e9f16ec2d6bb7fa5d04dc729bfafb7c262e33aa2b13bd4ff52e1050b7c9fe4768c63a8d82a5cb6c959a8e5d9170e82afb4f47b6055f246c883716a97299ee76eacb11b0d1e4beeaf5efd3ecd15f6395b40e9e29b06c308e22d833460b363c8e8ec5497f53866b1655ecca4fe5c34860a2f7d88fee2c3f98685af8729829c971fc1a16d6affb816d559e2440999e8db741148fa33db51a218ec2abdd6bdf190c4b7721b7dd36c1a1788bfb3bc14aeb979ce0e059b46bda1d182180fe46d7c56de8956f6ce64b85b2cca6e31e8c8ea30c3090bbe7454b217c80979bcdb0c802b5a4a0795edd4bcb11fdb7114bc1e59653274689530fcd6f5e84a5e7ad23e1f26129e48bfe450566791126dba7a3da69ad5e6730f498c267e3ca89760a9b6a7cb8dca4c6980fd58433193f78df0562429fb4bbe4e1484adb443e5dd50f3f4a91af0d3d37b987c623945cc5c6fb2db010fee3992c9a16d026410af8d608969da3367628feb29106497c6ef529dc7e48de81e1036c2bf0068d33e7f69ab65c3c13930b3aba111495c80e906542f6047fb7dcc3e770a7b43d87f310700d87a15ff138965bfc78f9d16e875825535d3aca4328aa725939e4a4544cd1fe8e772258485c41b6444b620200b3b2c5172a9ea13b79747157f1417fb8cb5eaf457571913696c779c7300991eeb51b7d61e99735aedb6e7aa9c24ec90f669706bafc28faa585e71d76db262d425d7882c2d7a00013ec4274c01d71564fae5e00f01f8c122728315fef1b80c4e8c1180a82565e82576e1018da9aaae9b1d3879350fd46f7cf3d93366236ea253d9dc4395237c2a06b27fcd19896294a320049773c3d9ac2001f75d3d0c34879f6ec31f4b43bde164147311d020bf5458deab4e5c804f00878d5938e228ce76034c34fff012051cd5a31cf7979cf41e6bc0c53a23b3ee4e8f0a9c20741a6167d0b15d8fbbc78adaaa687bb9c916aee900ebbeb7d75af",
    signature:
      "0x8754ee1ac90130cfb828172ed9e81fbbdf86f35298f05b3c152db673f2a6a82873e7acbdb5e2d0d035e253c396266254160e627e945a228a4c034157c7a4418efd08173e780ecbc30cedaae05f8239a453df924d8e8e11460f5e10b1c2024012",
    validatorProof: {
      depositAmount: 137,
      // Proof from beacon chain slot 12145621 which is execution layer block 22923668
      // So next block is 22923669 which is needed to set the parent beacon block root
      bytes:
        "0x0200000000000000000000008d84e1d10dd36de832549b525d09ae02825b84b56aa845b5bc63b3e02ed893c12395270ab812d5037f07848422ca5bca0c32ad227acaed3b0df28c00dea5d73add177d61599e0557652662aed8cb0d3660c8c55834045e71eeea95af8e6387ce442bc71c97520f0c73817a12fc938c02c2df6606485fc17ba0cacb97bf60a24649fa25e8f9735f00ba290f5326abdf1ed4b666920e73bb1cd62c992f3351d1ba6df0a34804b7a4f9f771febdaaae11fc7554c516f7330a2b034453ead5abd7a67f15da2acabaa5bd3e8337dcc72c013a44ae25366e122a3d7fef271e36ebece5b34ec3864fed40915d99c8a5ea2b22b4cbaa542ede39011814f92de0b7d3d210ae7e6483b145ed980107c9052536017334ba05e74bb60c8235fcd3a0cc8387d7d50dabb6bc80d251c7cb9d925e1e5005680b13c6e901446672fca79272f255180a281292b0521f9e210512147f9981570e0eba2f5da45e079aabec89844282bd8ce2a207d86d23d3acf91931b4164c3c82a8434711d2aae9e3714fb7f3f85ec4e0b94eebacca7020f6ba9db789289830d37c95c1dc780b83824c33ed9a4602c78cb294cabe50d5288daf7f974b7890d41d0389ecc18a95ef4052e45ef3813d4cb4936346b941b57d0cfec6e6d06cab25db4e5b575332a4f8e8fe5856e09fb0307faff4c4c86cd65f1232633985eee2e835bb5543ffbc9fae96a31e59159c5d02abe69fb16abf79e038bf188feaa215596f530c8a5d78f425c93b7ae2618708a663aeea2072b39f6c82a9e94208934aac447722502091694a22167adf183c7b8989e408b1166b3aeb3e58209a5fd4b8b455008a31a137c8f30ccc0c841cab8e43a450dd228a222cffc8fd7860f457e635b33bb6039def4a443b712c255e1ff4c45acdbfd3f33467499d0ea483d3f8e8517fd3c287c463bdfa01639dd97c4958e5f01466b524822e508b655fdd114eae2c35ad358af0476ab820285053f2ac14c6bf54ca249212a0985c31965e8a844a36f3fdd1445e68ab6ebb2f6d4d1e7804c2c561f64279aa294e71a90ed4e7e1356fbbc14a378a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206f85b21e0000000000000000000000000000000000000000000000000000000000c6341f000000000000000000000000000000000000000000000000000000000064f362ebbebed35401a76e4b6cd3571cb7d4aa34570a5c80968abaca292be98cb989749950f5c0a6759bc187f9ebb6fd274779f4cec4ed289be45b343f142ca5e788566b55848bce1bfd65c53e0ab603d80938d82d26d1b6a8e1052808c1ba5b0ed49f8bb58095e82dd7fa2c5502846df7b21e0939589102f5c68b1ba47b64b651c850a7171c1c56c23f7a1d3bdb116b072af1eb4f4bac80e1b8b7f68fdeca20d7241487ac6f78de4129bad248c82e219d89f3a22db57f1a5f7863ac78f67ecf8f2c61d63f9dd4a198f0de5ce9e1a7e2e38b57be9a716bbbbb4b545286b0268993a054be6fab494c904fa579e6333e89892bd616f8eaae4d23b03b984e1a1a5a",
      root: "0x52296912a63fba5a44ae4fb98542b917d41be7fd1955330caaa2c513e35b2a3b",
      leaf: "0xb1d3e454498123d8069f9138420c9a422fab4bf97f9786849b0d7daddb359f47",
      nextBlockTimestamp: 1752571487,
    },
    depositProof: {
      depositDataRoot:
        "0x9de115e290009d56d89d8d72d7ed1528aa2c2586609f879cbb4ba215f92f5d27",
      // Deposit on the execution layer
      depositBlockNumber: 22879304,
      depositSlot: 12101000,
      depositRoot:
        "0xb3bfff031af1d856d5a369cdc72290f058ebaef6e3f61669f54927471f16eb1d",
      // Processed on the beacon chain
      processedSlot: 12145621,
      processedBlockNumber: 22923668,
      processedRoot:
        "0x52296912a63fba5a44ae4fb98542b917d41be7fd1955330caaa2c513e35b2a3b",
      // First pending deposit slot
      firstPendingDepositSlot: 12101421,
      proof:
        "0x0000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b372eac1fcacaea3b2a9ca4e2ee0ef79578a9e0fda8157d9f0b3f55f7f1553f0fe4e8c0ef8320ac0c2b17178ef42dbd863b66d785c792db48a7026aef9ed345e7bc99457fd3895ecf2352c4ecd4b276cae33dc56a221ebca8e81e1e641d9ea930d233dc8f10150bd915442735875aba35a62b17bb3895bceb0a6769fbd911fc541c08f1bcdc7a9ec5127c57a1f8f5369e5e09cf0231e939269143cd42273e1f91592dcd8328c2e3eb9eddd7c6d2c91419c7ad0da0e56961b80f979eeaeab4237d474a594b09bcebc3eeeafc09819a8373b04fd726d53916f1d4f4344c64583dd1553345ff65640cd53bbe718dda4a3a7473fe2b6d6d4e878bba144c2f793633bf221939cf2f70bf3ce89e507f001f79b5f916d7f4111c5d57b1ac8bcc7ce761e8d2b0a10136797f6c8be69140bbe3a8662a2b45b5b11a74bc3ad3733a5dfb8408edfbc18fff0a09125b2331e025f156d506ef966a9466263dd2e66571f3999aadbb95de69beb5aece9c550f0550b1ea99fc07406ae40b609ddc6910be82cab56cfa91e33e8f986cff5901a989cde531dd30005bb48686d18c7a964aea551e3903be08f495df2d84eb6630acdd60edbb66c563dc1009c3a90727b3cdaf910fdfed5f4a87f5a9ba4be8fa61ea3a0d581e920fdef2cfb01198481c3c50de16e7f66fb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784d49a7502ffcfb0340b1d7885688500ca308161a7f96b62df9d083b71fcc8f2bb8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a46765a82b000000000000000000000000000000000000000000000000000000000000cfdbf745317e33f9cb06a5453901324f153a36cde3691bb269ca7a7844dfbce9e9cbebfbae6f4ae452bc80e7dda7fbc569c43bbc3d57cccaf383106ac65e07d04f0c7d8e82072582769b96078f962500c3f96a3628b779bcfee30986db2cb119c78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123c86374ad219762f056e7b4dd3d65ec897a65754d43ff29c0c9c15fbfc5fe0aa61d7241487ac6f78de4129bad248c82e219d89f3a22db57f1a5f7863ac78f67ecf8f2c61d63f9dd4a198f0de5ce9e1a7e2e38b57be9a716bbbbb4b545286b0268993a054be6fab494c904fa579e6333e89892bd616f8eaae4d23b03b984e1a1a5a",
    },
  },
  {
    // Register tx 0x8998d4f271f149cf48eabe8b8d0d6d8d0b914734758ac36f5845c042dab21eba
    // Deposit tx 0xbc44fa6de0a8e1e307aff7a4702681de4a82ec495db5eb2152a632538ac2bd86
    publicKey:
      "0x8120d1eedaa5d2fa64db35aac17a9fa6a1109ecdd45ce6f652cdb9680c8c5cc489faa351565c5dcf59a8bdf9c94493c7",
    publicKeyHash:
      "0xff08527678e0cdeb9c67bd52cff5338d11b944d63a0f28037aae135da4d8f472",
    index: 1998611,
    operatorIds: [1926, 1927, 1928, 1929],
    sharesData:
      "0xb931fab17500ef26774e34e92b3398ac3e2c188ff47f69a5b5458fa8bd9268a5ea15f835efd585dd9a4995d9b85b2d010fe70c59f75038b649e2c0e86a0c49af826fd43f98441e331d1b2d4b35b1ce07d99b85b5a8f2039dcda8810f1fef18b883e957ccb82235292da2117217dbf19ad56a8083d8ab850d014e4f7c51481015de064e59b1733572453662a00ef69e4b9024a4f4c8f3d5f0dacdd2877d6f7d4cb2523163f24401997fb484db6f1611c8fb813c63009aea92b1dd8c4f822a369bab2da23ef711e8959fe3a0d0c33e1bcb08860912c40b6e808f910094e57fc657533d35f172044e1d6ffd931988bf4e25b23e9ca90cb48e9e3cea7deca4eb52da1f944bfab07f9bf054cf5840e7955cf9e2290f2f3adf3d491c3ae764d92f5a20629e3cb40134ce98e03ce37da64a2bdb5a5197f4a1eb9b2a691eb36945c00af76c3a27fc637c4be14ea3c08234a28c9eae4014f291351d61542eb3f58592839e25a51b89a7a210265f13a091e7fe5bcdee6d760f7459038b53f78b0ff060c127855f819cd7d47836257ced4f58ff65b698f0b21f0f72dca961c8bc6563ac51731d45d3c296cddd2262864cc0ed3179a4841d3adfdb9fc46971947e79d22e370caf8804eafcd7187c208f99deddbc6cdd6217114efbadda87e3566005a057eeee3f03c124c808e002b8c640f83a8140febb4a35c9b23ba8cd7f553aed10067e26536b5fa1d50219f706f7cc13b29c356cf3f16b049ed9e0c426b811b4e4254c320dae4ed189c24628f393a65e8bccff0bf80e00d781c3b9deb86148dbcf6d1cfe6197c2ea779baabeec432a0201f7bedc2b4f8ddba26fff2fd087c06d21106eeead909d104840404ee16ead987b2def3da80337c9535636191971cd8af3d8ab151f98428e4dc07954c387081c1a7ce85eba134b92da1aa3395cab5b67dbe796ca809ddc7a564913a13f5b7340ba5db430555ae969ff7d7d70629fcb0ce457143cb4a1df4cba42472b6556c0a6c327734ce1006024e38d00d376173383ca92bcdcbb21bd9d40bae0f4bad05679db658c1290b46e4d2d1145b03717eddc1b4f728ec02999a6a19a7a29e0fa55eb69e8cda88e94aada7ad60e83b3cb137d9826e24b5ed204785ee082ed9fefdd4e39338493fdf99a77de7552c38c309ed2182ab74b3c89eab4397c9345129269c69bc8331b2456a9d1f572cf5be643dec74367423673ec10e82b2dc159c3f6c8b90ccd2765d6607c4e13a0b881355bfbecf24fe78065d9b469b1a5830d0b6be17e24279fd3147983cfeb5a96649adf174fbe1c9f4d5a8a5be93d1b65db22f5bb395cf855ccfadefbc4816ff98c7784c7936c8c67154259e0a3726c417199c2534e995e3cf8241c23273e05d38a5bd48054f73b01ddcbe03b6eb761e17cbf14f0422aaed6140fbff0804423e36c0cc05b3516778cc974208287af29873d12c3580959dd906f6c00f2dc26cbea179fecf8b3c1cddb8192d1c1767aee837dadc137e571b874ba73607c00d7db564dcf9eb4ebc6399cb52d24323aa9160eae065ce23224a0d8e6912afc53abd330a91c7c96e25cc3ccff814c0d49459363cf8e5621ee6388090effdce97a4aeca5dc468e6686cce0c425202b17e935628cccefc5d1503b730178f546ab6c8f0ab2ee7d398ee640cfec3f37629eadef4414627b065b802ae7cda778e92359c25002f5d5fa76d40f244073d8d73a6811ecc9d0cedfab9f41fdda618558cc8aff4f10a15dca2ce82a573eabccc762405bb7ab593911b26d42986cb269abf82b651749509980677b35423502549bfb4f09187e6bb1a7830304ea343ba4bf0768b6f1932966706c5b38cbabd4",
    signature:
      "0x81fee344968d68e6bb492f34cc3417e883d50ed7e69ddb35f037a17be0feb2c8c0ca595322654bfe616ae0e4b19dbc630e93e9c4840c1d891100bb21540e4c85d40933df15dce0521ac439ed64edc77e3e13ba516bbc7b2d5c478fa728a60c79",
    depositProof: {
      depositAmount: 64,
      depositDataRoot:
        "0x98944436d0bb89d370a4257db513572eb867d9e17bf2d318464044e9a1b04c07",
    },
  },
  {
    // register tx 0x94e113697fdae7e6be3dfaf128c8147a7a7896f46f57c42d825dfc5ad72a021f
    // deposit tx 0x5823e074eddcdfd72b79a184cb7d6b21bd4d6c959468dd00a751756125b6477d
    publicKey:
      "0xa8362aa1dd61743b73bda741c9144636e0c2af9d9e63f1b0d182d5ebdbd58c3c988d25e53f6da4bdb102efec2ae7f8bc",
    publicKeyHash:
      "0xf752db0fbb501101e6eaa793b251f19fb00cb5265c2298cd88ece23fb815570e",
    index: 1927585,
    operatorIds: [684, 685, 686, 687],
    sharesData:
      "0xb4975324cc4c5c6e79772013e87904cff08e6445310ad2a06d495ec7a8b5b80322710be8ec39619da164066ad04a1605131f2efe8c0508ea2c2d4c13aa4bbe6058a44dfd528d5a33482a7e8507486d6b91565450e8d9e695ee96a79dff065308af178eb109fc3ffaf56552b5a5f0be236b936e0a6d9896bc9b2d4040b0aae455eda40849ce803ac578b1df306ed88c0ca9b3422c268a8e9a7686338a0f8c8fc41159add5a02a419aaf281bf2f083492d8c826dfdaebc803e024619e90e4ed24a97940ff3ad744d52fd299a9aeb2f5fc14e33f0c55e133c85580e8b1e5c6b947390ceef4c3bfaf297c2d1acb28c6caa069578b43cdd722f4c48ba52a4b7247fbbf5303b3b9a730e00f908b2440dab229921e6c7f8bc657271f3009b6dc0af0da62abf71f21063b65a4707a3b610267ede2f4fabd70b8ad9b37c847ecfc6c901b2bf252216d94ad338afa2049c7781dc9a436d85d438815b446a7d8145e146d72d3db4ffbf8143217d9834e7c91031fe3266e62476676204442114b1574b14714c76466bf4bca746ff59ddf37cef15991173cc3ddafb94a101cc2f5cd7997ef272bc725d4fc4c4fda60e346a8c728e31bcfbf1f758ddf060d2a2c7a6bd13b73566101ffe0b855e5aea6477fcfbc7f258e824ac6fad557225475ca4f492619e9f0514726c8abab31502ffac4b31fae56cb9d6d0011a1e02121e10cf994eee9ecfc7efd6a75793de806a2f743a1fdef11c741c51171febfe6984374726743975ab5b1fe269baff7aa47c0d96f0cd324a979c3e4427f9806f6eb4340ba05813dcb1a4df7cc5c14f932cd9de2712b16b7ea9f5e0ec3999336463300ad83f42d942bdd439fac3dc0e9157752e656ef7e69412dc20be850426be09f8143d080170f4936b51b4460fb9096b810dbe9e683f75c6d2c707c80d8ab5bfc3801b716b43f5180eb6d876c332c8451cfbb6bb67b54750ddda1eeeb16dcb28884b9d8e0838c2245cc627d4f8758db0a92524cfac2b1dc30363afba5a87dcbe5942659e81615d139b67d22aabf28f29cb89e901220f88da55097a82d4d21ac3540ac65413e6127784784f41c6659ec1d9b77be093a7225b5bcb2a0a939d3eb797dbcb698751c99822ca87a08da5596f443a7e90036c3df0bdc6287c095f1e992b397b19f3d4db0b5befcc7ec912d544ff840c7e18ae0278869b9744ca958bd7baad3640f4ad1230e539dd8fa18474d7af254e26f623ff8b31c5cfbb899a0ff1455b0863de2c3b8055b22a7ab22ede907e260b53d4e8b163f73a302531d6d54e19433fbe6f37af28ac0ee57b2c52db7f8ea78d52295d9590d5ce698f4c5d128277988be1651682dca48ae68f456a702530c0c09881cbee5c302eb3067a8ea3c12359b8b527ce1195bbeb086a28451af3035d24af4bd1ce88cc91e0c3068cbf5f48029516dc37e54f0ea770093c27208c6b38076091708f00101410b81ab1398aa2c49a04ee3e102de1574cf47accf6565ac796699933a1f5b6448a8063dfa4d1d33ba395201492ac1e979054cd50c4005b5bca8744b8dafbac66f85266203c90f82896ecc883402d08d776f2d17a1cf0342e5023479423c0744565b5e2e901b9234e82601cf9a4ac11a1cdfd3ef43b578a2817622c8f3661dc0b5d3a486d66d9f5c7389d50e7e309a6a636d502c3de5d655b5facbf53bd00211c9feccc8e3b23ed117476e995d43fa30bad694794f4e4bc9f6290b43de4be19b93eca086b46089abeb3c69e69de1f2acee146274b4009348d9f4be26237d28f89ff40f985bcf81d53b2c78a74fee19ce3710d96b2e74ada3d61a4f4c1ea9586e94bb0454d0e5e5362dc6098be4cf3af",
    signature:
      "0xa26f9988d2df42692270c1cf4c218feabcdb30f83fd751e1d480e82d09871a208edb7b1b20b922d23f0c1ed0698d4bf502554cd2312eb3058328091e0e4ef61bba31f2b3d872aaae536278d05e9a466c10c5b4722819787b44e09e3bb5c593b6",
    depositProof: {
      depositAmount: 500,
      depositDataRoot:
        "0x36a4a9d68b0545fcd002334a473bc4229e59da5dfc66c72912d75030763a7b6f",
    },
  },
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
        testValidator.validatorProof.leaf
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
    it("Should remove a validator", async () => {
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

      return beaconBlockRoot;
    };

    it("Should verify balances with no WETH, no deposits and no validators", async () => {
      const { compoundingStakingSSVStrategy } = fixture;
      const beaconBlockRoot = await snapBalances();

      await compoundingStakingSSVStrategy.verifyBalances({
        blockRoot: beaconBlockRoot,
        firstPendingDepositSlot: 0,
        firstPendingDepositSlotProof: "0x",
        balancesContainerRoot: ethers.utils.hexZeroPad("0x0", 32),
        validatorContainerProof: "0x",
        validatorBalanceLeaves: [],
        validatorBalanceProofs: [],
      });

      expect(
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
        "Last verified ETH balance"
      ).to.equal(0);
    });

    it("Should verify balances with some WETH, no deposits and no validators", async () => {
      const { compoundingStakingSSVStrategy, josh, weth } = fixture;
      const beaconBlockRoot = await snapBalances();

      expect(
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance()
      ).to.equal(0);

      const wethAmount = parseEther("1.23");
      // Send some WETH to the strategy
      await weth
        .connect(josh)
        .transfer(compoundingStakingSSVStrategy.address, wethAmount);

      await compoundingStakingSSVStrategy.verifyBalances({
        blockRoot: beaconBlockRoot,
        firstPendingDepositSlot: 0,
        firstPendingDepositSlotProof: "0x",
        balancesContainerRoot: ethers.utils.hexZeroPad("0x0", 32),
        validatorContainerProof: "0x",
        validatorBalanceLeaves: [],
        validatorBalanceProofs: [],
      });

      expect(
        await compoundingStakingSSVStrategy.lastVerifiedEthBalance(),
        "Last verified ETH balance"
      ).to.equal(wethAmount);
    });
    describe("Should not change verified balance when", () => {
      it("register validator", async () => {
        await snapBalances();
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
