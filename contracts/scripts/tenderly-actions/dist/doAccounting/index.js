'use strict';

require('ethers');
var require$$1 = require('tty');
var require$$1$1 = require('util');
var require$$0 = require('os');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var actions = {};

var networks = {};

Object.defineProperty(networks, "__esModule", { value: true });
networks.Network = void 0;
/**
 * Networks supported by Web3 Actions
 */
var Network$1;
(function (Network) {
    Network["AF_NEXUS_TESTNET"] = "af-nexus-testnet";
    Network["AMOY"] = "polygon-amoy";
    Network["APECHAIN"] = "apechain";
    Network["ARBITRUM"] = "arbitrum";
    Network["ARBITRUM_NOVA"] = "arbitrum-nova";
    Network["ARBITRUM_SEPOLIA"] = "arbitrum-sepolia";
    Network["AVA"] = "ava";
    Network["BASE"] = "base";
    Network["BASE_SEPOLIA"] = "base-sepolia";
    Network["BEPOLIA"] = "bepolia";
    Network["BERACHAIN"] = "berachain";
    Network["BERACHAIN_BARTIO"] = "berachain-bartio";
    Network["BLAST"] = "blast";
    Network["BOB"] = "bob-mainnet";
    Network["BOBA_AVALANCHE"] = "boba-avalanche";
    Network["BOBA_AVALANCHE_FUJI"] = "boba-avalanche-fuji";
    Network["BOBA_BINANCE"] = "boba-binance";
    Network["BOBA_BINANCE_RIALTO"] = "boba-binance-rialto";
    Network["BOBA_ETHEREUM"] = "boba-ethereum";
    Network["BOBA_SEPOLIA"] = "boba-sepolia";
    Network["BOB_SEPOLIA"] = "bob-sepolia";
    Network["BOB_TESTNET"] = "bob-testnet";
    Network["BSC"] = "bsc";
    Network["BSC_TESTNET"] = "bsc-testnet";
    Network["CELO"] = "celo";
    Network["CELO_ALFAJORES_TESTNET"] = "celo-alfajores-testnet";
    Network["CFX_ESPACE"] = "cfx-espace";
    Network["CFX_ESPACE_TESTNET"] = "cfx-espace-testnet";
    Network["CONCRETE"] = "concrete";
    Network["CONCRETE_TESTNET"] = "concrete-testnet";
    Network["CONVERGE_TESTNET"] = "converge-testnet";
    Network["CORN"] = "corn";
    Network["CORN_TESTNET"] = "corn-testnet";
    Network["CRONOS"] = "cronos";
    Network["CRONOS_TESTNET"] = "cronos-testnet";
    Network["CURTIS"] = "curtis";
    Network["ETHEREAL_TESTNET"] = "ethereal-testnet";
    Network["FLARE"] = "flare";
    Network["FRAXTAL"] = "fraxtal-mainnet";
    Network["FRAXTAL_HOLESKY"] = "fraxtal-holesky";
    Network["FUJI"] = "fuji";
    Network["GNOSIS_CHAIN"] = "gnosis-chain";
    Network["GOLD_MAINNET"] = "gold-mainnet";
    Network["HOLESKY"] = "holesky";
    Network["HOODI"] = "hoodi";
    Network["IMMUTABLE"] = "immutable-mainnet";
    Network["IMMUTABLE_TESTNET"] = "immutable-testnet";
    Network["INJECTIVE_TESTNET"] = "injective-testnet";
    Network["INK_SEPOLIA"] = "ink-sepolia";
    Network["INTERVAL_TESTNET"] = "interval-testnet";
    Network["KATANA"] = "katana";
    Network["KATANA_BOKUTO"] = "katana-bokuto";
    Network["KATANA_TATARA"] = "katana-tatara";
    Network["KINTO"] = "kinto-mainnet";
    Network["LENS"] = "lens";
    Network["LENS_SEPOLIA"] = "lens-sepolia";
    Network["LINEA"] = "linea";
    Network["LINEA_SEPOLIA"] = "linea-sepolia";
    Network["LISK"] = "lisk-mainnet";
    Network["LISK_SEPOLIA"] = "lisk-sepolia";
    Network["MAINNET"] = "mainnet";
    Network["MANTLE"] = "mantle";
    Network["MANTLE_SEPOLIA"] = "mantle-sepolia";
    Network["METIS_ANDROMEDA"] = "metis-andromeda";
    Network["METIS_SEPOLIA"] = "metis-sepolia";
    Network["MODE"] = "mode";
    Network["MODE_SEPOLIA"] = "mode-sepolia";
    Network["MOONBASE_ALPHA"] = "moonbase-alpha";
    Network["MOONBEAM"] = "moonbeam";
    Network["MOONRIVER"] = "moonriver";
    Network["MORPH"] = "morph";
    Network["MORPH_HOLESKY"] = "morph-holesky";
    Network["OPTIMISTIC"] = "optimistic";
    Network["OPTIMISTIC_SEPOLIA"] = "optimistic-sepolia";
    Network["PEAQ"] = "peaq";
    Network["PEAQ_AGUNG"] = "peaq-agung";
    Network["PLASMA"] = "plasma";
    Network["PLASMA_TESTNET"] = "plasma-testnet";
    Network["PLUME"] = "plume";
    Network["PLUME_TESTNET"] = "plume-testnet";
    Network["POLYGON"] = "polygon";
    Network["POLYNOMIAL"] = "polynomial-mainnet";
    Network["POLYNOMIAL_SEPOLIA"] = "polynomial-sepolia";
    Network["RONIN"] = "ronin";
    Network["RONIN_TESTNET"] = "ronin-testnet";
    Network["RSK"] = "rsk";
    Network["RSK_TESTNET"] = "rsk-testnet";
    Network["SCROLL"] = "scroll-mainnet";
    Network["SCROLL_SEPOLIA"] = "scroll-sepolia";
    Network["SEI_ATLANTIC_2"] = "sei-atlantic-2";
    Network["SEI_PACIFIC_1"] = "sei-pacific-1";
    Network["SEPOLIA"] = "sepolia";
    Network["SHAPE"] = "shape";
    Network["SHAPE_SEPOLIA"] = "shape-sepolia";
    Network["SONEIUM"] = "soneium";
    Network["SONEIUM_MINATO"] = "soneium-minato";
    Network["SONIC"] = "sonic";
    Network["SONIC_BLAZE"] = "sonic-blaze";
    Network["SOPHON"] = "sophon";
    Network["SOPHON_TESTNET"] = "sophon-testnet";
    Network["STABLE_TESTNET"] = "stable-testnet";
    Network["STORY"] = "story";
    Network["STORY_AENEID"] = "story-aeneid";
    Network["SWELLCHAIN"] = "swellchain";
    Network["SWELLCHAIN_SEPOLIA"] = "swellchain-sepolia";
    Network["TAC"] = "tac";
    Network["TAC_SPB_TESTNET"] = "tac-spb-testnet";
    Network["TAIKO"] = "taiko-mainnet";
    Network["TAIKO_HEKLA"] = "taiko-hekla";
    Network["TANGIBLE_REAL"] = "tangible-real";
    Network["TANGIBLE_UNREAL"] = "tangible-unreal";
    Network["UNICHAIN"] = "unichain";
    Network["UNICHAIN_SEPOLIA"] = "unichain-sepolia";
    Network["WORLDCHAIN"] = "worldchain-mainnet";
    Network["WORLDCHAIN_SEPOLIA"] = "worldchain-sepolia";
    Network["ZETACHAIN"] = "zetachain";
    Network["ZETACHAIN_TESTNET"] = "zetachain-testnet";
    Network["ZIRCUIT"] = "zircuit";
    Network["ZIRCUIT_GARFIELD_TESTNET"] = "zircuit-garfield-testnet";
    Network["ZKSYNC"] = "zksync";
    Network["ZKSYNC_SEPOLIA"] = "zksync-sepolia";
    Network["ZORA"] = "zora";
    Network["ZORA_SEPOLIA"] = "zora-sepolia";
    Network["ZORA_TESTNET"] = "zora-testnet";
})(Network$1 || (networks.Network = Network$1 = {}));

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Network = void 0;
	// Re-export network types from their respective files
	var networks_1 = networks;
	Object.defineProperty(exports, "Network", { enumerable: true, get: function () { return networks_1.Network; } });
	
} (actions));

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";
addresses.ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
addresses.createX = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed";
addresses.multichainStrategist = "0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971";
addresses.multichainBuybackOperator =
  "0xBB077E716A5f1F1B63ed5244eBFf5214E50fec8c";
addresses.votemarket = "0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9";

addresses.mainnet = {};
addresses.base = {};
addresses.sonic = {};
addresses.holesky = {};
addresses.hoodi = {};
addresses.plume = {};

addresses.mainnet.ORIGINTEAM = "0x449e0b5564e0d141b3bc3829e74ffa0ea8c08ad5";

addresses.mainnet.Binance = "0xf977814e90da44bfa03b6295a0616a897441acec";
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
addresses.mainnet.BinanceAll =
  "0x564286362092d8e7936f0549571a803b203aaced,0xbe0eb53f46cd790cd13851d5eff43d12404d33e8,0xf977814e90da44bfa03b6295a0616a897441acec,0x28c6c06298d514db089934071355e5743bf21d60,0xdfd5293d8e347dfe59e90efd55b2956a1343963d,0x56eddb7aa87536c09ccc2793473599fd21a8b17f,0x21a31ee1afc51d94c2efccaa2092ad1028285549,0x9696f59e4d72e237be84ffd425dcad154bf96976,0x001866ae5b3de6caa5a51543fd9fb64f524f5478,0xab83d182f3485cf1d6ccdd34c7cfef95b4c08da4,0x8b99f3660622e21f2910ecca7fbe51d654a1517d,0x4d9ff50ef4da947364bb9650892b2554e7be5e2b,0xb8c77482e45f1f44de1745f52c74426c631bdd52,0x61189da79177950a7272c88c6058b96d4bcd6be2,0x0681d8db095565fe8a346fa0277bffde9c0edbbf,0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67,0x85b931a32a0725be14285b66f1a22178c672d69b,0x8f22f2063d253846b53609231ed80fa571bc0c8f,0xe0f0cfde7ee664943906f17f7f14342e76a5cec7,0x708396f17127c42383e3b9014072679b2f60b82f,0xd551234ae421e3bcba99a0da6d736074f22192ff,0xfe9e8709d3215310075d67e3ed32a380ccf451c8,0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be,0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf";
addresses.mainnet.WhaleAddresses =
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0,0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e,0x9c3B46C0Ceb5B9e304FCd6D88Fc50f7DD24B31Bc,0xa1F8A6807c402E4A15ef4EBa36528A3FED24E577,0xc6424e862f1462281b0a5fac078e4b63006bdebf,0xba12222222228d8ba445958a75a0704d566bf2c8";
addresses.mainnet.oethWhaleAddress =
  "0xA7c82885072BADcF3D0277641d55762e65318654";

// Native stablecoins
addresses.mainnet.DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
addresses.mainnet.USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
addresses.mainnet.USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
addresses.mainnet.TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
addresses.mainnet.USDS = "0xdC035D45d973E3EC169d2276DDab16f1e407384F";
// AAVE
addresses.mainnet.AAVE_ADDRESS_PROVIDER =
  "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5"; // v2
addresses.mainnet.Aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"; // v1-v2
addresses.mainnet.aTUSD = "--"; // Todo: use v2
addresses.mainnet.aUSDT = "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811"; // v2
addresses.mainnet.aDAI = "0x028171bca77440897b824ca71d1c56cac55b68a3"; // v2
addresses.mainnet.aUSDC = "0xBcca60bB61934080951369a648Fb03DF4F96263C"; // v2
addresses.mainnet.aWETH = "0x030ba81f1c18d280636f32af80b9aad02cf0854e"; // v2
addresses.mainnet.STKAAVE = "0x4da27a545c0c5b758a6ba100e3a049001de870f5"; // v1-v2
addresses.mainnet.AAVE_INCENTIVES_CONTROLLER =
  "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5"; // v2

// Compound
addresses.mainnet.COMP = "0xc00e94Cb662C3520282E6f5717214004A7f26888";
addresses.mainnet.cDAI = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
addresses.mainnet.cUSDC = "0x39aa39c021dfbae8fac545936693ac917d5e7563";
addresses.mainnet.cUSDT = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
// Curve
addresses.mainnet.CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
addresses.mainnet.CRVMinter = "0xd061D61a4d941c39E5453435B6345Dc261C2fcE0";
addresses.mainnet.ThreePool = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
addresses.mainnet.ThreePoolToken = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
addresses.mainnet.ThreePoolGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
// CVX
addresses.mainnet.CVX = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";
addresses.mainnet.CVXBooster = "0xF403C135812408BFbE8713b5A23a04b3D48AAE31";
addresses.mainnet.CVXRewardsPool = "0x7D536a737C13561e0D2Decf1152a653B4e615158";
addresses.mainnet.CVXLocker = "0x72a19342e8F1838460eBFCCEf09F6585e32db86E";

// Maker Dai Savings Rate
addresses.mainnet.sDAI = "0x83F20F44975D03b1b09e64809B757c47f942BEeA";
// Maker USDS Savings Rate
addresses.mainnet.sUSDS = "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD";
// Open Oracle
addresses.mainnet.openOracle = "0x922018674c12a7f0d394ebeef9b58f186cde13c1";
// OGN
addresses.mainnet.OGN = "0x8207c1ffc5b6804f6024322ccf34f29c3541ae26";
// LUSD
addresses.mainnet.LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
// OGV
addresses.mainnet.OGV = "0x9c354503C38481a7A7a51629142963F98eCC12D0";
// veOGV
addresses.mainnet.veOGV = "0x0C4576Ca1c365868E162554AF8e385dc3e7C66D9";
// RewardsSource
addresses.mainnet.RewardsSource = "0x7d82e86cf1496f9485a8ea04012afeb3c7489397";
// OGNRewardsSource
addresses.mainnet.OGNRewardsSource =
  "0x7609c88E5880e934dd3A75bCFef44E31b1Badb8b";
// xOGN
addresses.mainnet.xOGN = "0x63898b3b6Ef3d39332082178656E9862bee45C57";

// Uniswap router
addresses.mainnet.uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
addresses.mainnet.uniswapV3Router =
  "0xe592427a0aece92de3edee1f18e0157c05861564";
addresses.mainnet.sushiswapRouter =
  "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
addresses.mainnet.uniswapV3Quoter =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
addresses.mainnet.uniswapUniversalRouter =
  "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B";

// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.mainnet.chainlinkETH_USD =
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
addresses.mainnet.chainlinkDAI_USD =
  "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9";
addresses.mainnet.chainlinkUSDC_USD =
  "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";
addresses.mainnet.chainlinkUSDT_USD =
  "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D";
addresses.mainnet.chainlinkCOMP_USD =
  "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5";
addresses.mainnet.chainlinkAAVE_USD =
  "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9";
addresses.mainnet.chainlinkCRV_USD =
  "0xcd627aa160a6fa45eb793d19ef54f5062f20f33f";
addresses.mainnet.chainlinkCVX_USD =
  "0xd962fC30A72A84cE50161031391756Bf2876Af5D";
addresses.mainnet.chainlinkOGN_ETH =
  "0x2c881B6f3f6B5ff6C975813F87A4dad0b241C15b";
// DEPRECATED Chainlink
addresses.mainnet.chainlinkDAI_ETH =
  "0x773616E4d11A78F511299002da57A0a94577F1f4";
addresses.mainnet.chainlinkUSDC_ETH =
  "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
addresses.mainnet.chainlinkUSDT_ETH =
  "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";
addresses.mainnet.chainlinkRETH_ETH =
  "0x536218f9E9Eb48863970252233c8F271f554C2d0";
addresses.mainnet.chainlinkstETH_ETH =
  "0x86392dC19c0b719886221c78AB11eb8Cf5c52812";
addresses.mainnet.chainlinkcbETH_ETH =
  "0xF017fcB346A1885194689bA23Eff2fE6fA5C483b";
addresses.mainnet.chainlinkBAL_ETH =
  "0xC1438AA3823A6Ba0C159CfA8D98dF5A994bA120b";
addresses.mainnet.ccipRouterMainnet =
  "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";
addresses.mainnet.ccipWoethTokenPool =
  "0xdCa0A2341ed5438E06B9982243808A76B9ADD6d0";

// WETH Token
addresses.mainnet.WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// Deployed OUSD contracts
addresses.mainnet.Guardian = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899"; // 5/8 multisig.
addresses.mainnet.VaultProxy = "0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70";
addresses.mainnet.Vault = "0xf251Cb9129fdb7e9Ca5cad097dE3eA70caB9d8F9";
addresses.mainnet.OUSDProxy = "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86";
addresses.mainnet.OUSD = "0xB72b3f5523851C2EB0cA14137803CA4ac7295f3F";
addresses.mainnet.CompoundStrategyProxy =
  "0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3";
addresses.mainnet.CompoundStrategy =
  "0xFaf23Bd848126521064184282e8AD344490BA6f0";
addresses.mainnet.CurveUSDCStrategyProxy =
  "0x67023c56548BA15aD3542E65493311F19aDFdd6d";
addresses.mainnet.CurveUSDCStrategy =
  "0x96E89b021E4D72b680BB0400fF504eB5f4A24327";
addresses.mainnet.CurveUSDTStrategyProxy =
  "0xe40e09cD6725E542001FcB900d9dfeA447B529C0";
addresses.mainnet.CurveUSDTStrategy =
  "0x75Bc09f72db1663Ed35925B89De2b5212b9b6Cb3";
addresses.mainnet.CurveOUSDMetaPool =
  "0x87650D7bbfC3A9F10587d7778206671719d9910D";
addresses.mainnet.CurveLUSDMetaPool =
  "0x7A192DD9Cc4Ea9bdEdeC9992df74F1DA55e60a19";
addresses.mainnet.ConvexOUSDAMOStrategy =
  "0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90";
addresses.mainnet.CurveOUSDAMOStrategy =
  "0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11";
addresses.mainnet.CurveOUSDGauge = "0x25f0cE4E2F8dbA112D9b115710AC297F816087CD";
addresses.mainnet.ConvexVoter = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";
addresses.mainnet.CurveOUSDUSDTPool =
  "0x37715d41ee0af05e77ad3a434a11bbff473efe41";
addresses.mainnet.CurveOUSDUSDTGauge =
  "0x74231E4d96498A30FCEaf9aACCAbBD79339Ecd7f";

// Curve OETH/ETH pool
addresses.mainnet.ConvexOETHAMOStrategy =
  "0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63";
addresses.mainnet.CurveOETHMetaPool =
  "0x94B17476A93b3262d87B9a326965D1E91f9c13E7";
addresses.mainnet.CurveOETHGauge = "0xd03BE91b1932715709e18021734fcB91BB431715";
addresses.mainnet.CVXETHRewardsPool =
  "0x24b65DC1cf053A8D96872c323d29e86ec43eB33A";

addresses.mainnet.CompoundingStakingStrategyProxy =
  "0x840081c97256d553A8F234D469D797B9535a3B49";

// Votemarket - StakeDAO
addresses.mainnet.CampaignRemoteManager =
  "0x53aD4Cd1F1e52DD02aa9FC4A8250A1b74F351CA2";

// Morpho
addresses.mainnet.MorphoStrategyProxy =
  "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D";
addresses.mainnet.MorphoAaveStrategyProxy =
  "0x79F2188EF9350A1dC11A062cca0abE90684b0197";
addresses.mainnet.HarvesterProxy = "0x21Fb5812D70B3396880D30e90D9e5C1202266c89";
addresses.mainnet.MorphoSteakhouseUSDCVault =
  "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB";
addresses.mainnet.MorphoGauntletPrimeUSDCVault =
  "0xdd0f28e19C1780eb6396170735D45153D261490d";
addresses.mainnet.MorphoGauntletPrimeUSDTVault =
  "0x8CB3649114051cA5119141a34C200D65dc0Faa73";

addresses.mainnet.UniswapOracle = "0xc15169Bad17e676b3BaDb699DEe327423cE6178e";
addresses.mainnet.CompensationClaims =
  "0x9C94df9d594BA1eb94430C006c269C314B1A8281";
addresses.mainnet.Flipper = "0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70";

// Morpho
addresses.mainnet.Morpho = "0x8888882f8f843896699869179fB6E4f7e3B58888";
addresses.mainnet.MorphoLens = "0x930f1b46e1d081ec1524efd95752be3ece51ef67";
addresses.mainnet.MorphoToken = "0x58D97B57BB95320F9a05dC918Aef65434969c2B2";
addresses.mainnet.LegacyMorphoToken =
  "0x9994E35Db50125E0DF82e4c2dde62496CE330999";

// Governance
addresses.mainnet.Timelock = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
addresses.mainnet.OldTimelock = "0x72426BA137DEC62657306b12B1E869d43FeC6eC7";
// OGV Governance
addresses.mainnet.GovernorFive = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
// OGN Governance
addresses.mainnet.GovernorSix = "0x1D3Fbd4d129Ddd2372EA85c5Fa00b2682081c9EC";

// OETH
addresses.mainnet.OETHProxy = "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3";
addresses.mainnet.WOETHProxy = "0xDcEe70654261AF21C44c093C300eD3Bb97b78192";
addresses.mainnet.OETHVaultProxy = "0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab";
addresses.mainnet.OETHZapper = "0x9858e47BCbBe6fBAC040519B02d7cd4B2C470C66";
addresses.mainnet.FraxETHStrategy =
  "0x3ff8654d633d4ea0fae24c52aec73b4a20d0d0e5";
addresses.mainnet.FraxETHRedeemStrategy =
  "0x95A8e45afCfBfEDd4A1d41836ED1897f3Ef40A9e";
addresses.mainnet.OETHHarvesterProxy =
  "0x0D017aFA83EAce9F10A8EC5B6E13941664A6785C";
// TODO add after deployment
addresses.mainnet.OETHHarvesterSimpleProxy =
  "0x6D416E576eECBB9F897856a7c86007905274ed04";
addresses.mainnet.BalancerRETHStrategy =
  "0x49109629aC1deB03F2e9b2fe2aC4a623E0e7dfDC";
// OETH Tokens
addresses.mainnet.sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
addresses.mainnet.frxETH = "0x5E8422345238F34275888049021821E8E08CAa1f";
addresses.mainnet.rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393";
addresses.mainnet.stETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
addresses.mainnet.wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
addresses.mainnet.FraxETHMinter = "0xbAFA44EFE7901E04E39Dad13167D089C559c1138";

// 1Inch
addresses.mainnet.oneInchRouterV5 =
  "0x1111111254EEB25477B68fb85Ed929f73A960582";

// Balancer
addresses.mainnet.BAL = "0xba100000625a3754423978a60c9317c58a424e3D";
addresses.mainnet.balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
// wstETH/WETH
addresses.mainnet.wstETH_WETH_BPT =
  "0x32296969Ef14EB0c6d29669C550D4a0449130230";
addresses.mainnet.wstETH_WETH_AuraRewards =
  "0x59D66C58E83A26d6a0E35114323f65c3945c89c1";
// rETH/WETH
addresses.mainnet.rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276";
addresses.mainnet.rETH_WETH_AuraRewards =
  "0xDd1fE5AD401D4777cE89959b7fa587e569Bf125D";
// wstETH/sfrxETH/rETH
addresses.mainnet.wstETH_sfrxETH_rETH_BPT =
  "0x42ed016f826165c2e5976fe5bc3df540c5ad0af7";
addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards =
  "0xd26948E7a0223700e3C3cdEA21cA2471abCb8d47";

// Aura
addresses.mainnet.AURA = "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF";
addresses.mainnet.AuraWeightedOraclePool =
  "0xc29562b045D80fD77c69Bec09541F5c16fe20d9d";

// Frax Oracle for frxETH/ETH
addresses.mainnet.FrxEthFraxOracle =
  "0xC58F3385FBc1C8AD2c0C9a061D7c13b141D7A5Df";
// FrxEthEthDualOracle gets the oracle prices from the Curve and Uniswap pools
addresses.mainnet.FrxEthEthDualOracle =
  "0xb12c19C838499E3447AFd9e59274B1BE56b1546A";
// FrxEthWethDualOracle
addresses.mainnet.FrxEthWethDualOracle =
  "0x350a9841956D8B0212EAdF5E14a449CA85FAE1C0";

// Curve Pools
addresses.mainnet.CurveTriPool = "0x4ebdf703948ddcea3b11f675b4d1fba9d2414a14";
addresses.mainnet.CurveCVXPool = "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4";
addresses.mainnet.CurveOUSDUSDTPool =
  "0x37715d41ee0af05e77ad3a434a11bbff473efe41";
addresses.mainnet.curve = {};
addresses.mainnet.curve.OUSD_USDC = {};
addresses.mainnet.curve.OUSD_USDC.pool =
  "0x6d18E1a7faeB1F0467A77C0d293872ab685426dc";
addresses.mainnet.curve.OUSD_USDC.gauge =
  "0x1eF8B6Ea6434e722C916314caF8Bf16C81cAF2f9";
addresses.mainnet.curve.OETH_WETH = {};
addresses.mainnet.curve.OETH_WETH.pool =
  "0xcc7d5785AD5755B6164e21495E07aDb0Ff11C2A8";
addresses.mainnet.curve.OETH_WETH.gauge =
  "0x36cC1d791704445A5b6b9c36a667e511d4702F3f";

// SSV network
addresses.mainnet.SSV = "0x9D65fF81a3c488d585bBfb0Bfe3c7707c7917f54";
addresses.mainnet.SSVNetwork = "0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1";

// Beacon chain contracts
addresses.mainnet.beaconChainDepositContract =
  "0x00000000219ab540356cBB839Cbe05303d7705Fa";
addresses.mainnet.mockBeaconRoots =
  "0xC033785181372379dB2BF9dD32178a7FDf495AcD";
addresses.mainnet.beaconRoots = "0x000f3df6d732807ef1319fb7b8bb8522d0beac02";
addresses.mainnet.beaconChainWithdrawRequest =
  "0x00000961Ef480Eb55e80D19ad83579A64c007002";

// Native Staking Strategy
addresses.mainnet.NativeStakingSSVStrategyProxy =
  "0x34eDb2ee25751eE67F68A45813B22811687C0238";
addresses.mainnet.NativeStakingSSVStrategy2Proxy =
  "0x4685dB8bF2Df743c861d71E6cFb5347222992076";
addresses.mainnet.NativeStakingSSVStrategy3Proxy =
  "0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63";

// Defender relayer
addresses.mainnet.validatorRegistrator =
  "0x4b91827516f79d6F6a1F292eD99671663b09169a";

// Lido Withdrawal Queue
addresses.mainnet.LidoWithdrawalQueue =
  "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1";

// DAI > USDS Migration Contract
addresses.mainnet.DaiUsdsMigrationContract =
  "0x3225737a9bbb6473cb4a45b7244aca2befdb276a";

// Safe Module
addresses.mainnet.ClaimStrategyRewardsSafeModule =
  "0x1b84E64279D63f48DdD88B9B2A7871e817152A44";

// LayerZero
addresses.mainnet.LayerZeroEndpointV2 =
  "0x1a44076050125825900e736c501f859c50fE728c";
addresses.mainnet.WOETHOmnichainAdapter =
  "0x7d1bea5807e6af125826d56ff477745bb89972b8";
addresses.mainnet.ETHOmnichainAdapter =
  "0x77b2043768d28E9C9aB44E1aBfC95944bcE57931";

addresses.mainnet.passthrough = {};
addresses.mainnet.passthrough.curve = {};
addresses.mainnet.passthrough.curve.OUSD_3POOL =
  "0x261Fe804ff1F7909c27106dE7030d5A33E72E1bD";
addresses.mainnet.passthrough.uniswap = {};
addresses.mainnet.passthrough.uniswap.OUSD_USDT =
  "0xF29c14dD91e3755ddc1BADc92db549007293F67b";
addresses.mainnet.passthrough.uniswap.OETH_OGN =
  "0x2D3007d07aF522988A0Bf3C57Ee1074fA1B27CF1";
addresses.mainnet.passthrough.uniswap.OETH_WETH =
  "0x216dEBBF25e5e67e6f5B2AD59c856Fc364478A6A";

// General purpose execution to consensus layer communication
addresses.mainnet.toConsensus = {};
addresses.mainnet.toConsensus.consolidation =
  "0x0000BBdDc7CE488642fb579F8B00f3a590007251";
addresses.mainnet.toConsensus.withdrawals =
  "0x00000961Ef480Eb55e80D19ad83579A64c007002";

// Arbitrum One
addresses.arbitrumOne = {};
addresses.arbitrumOne.WOETHProxy = "0xD8724322f44E5c58D7A815F542036fb17DbbF839";
addresses.arbitrumOne.admin = "0xfD1383fb4eE74ED9D83F2cbC67507bA6Eac2896a";

// Base
addresses.base.HarvesterProxy = "0x247872f58f2fF11f9E8f89C1C48e460CfF0c6b29";
addresses.base.BridgedWOETH = "0xD8724322f44E5c58D7A815F542036fb17DbbF839";
addresses.base.AERO = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
addresses.base.aeroRouterAddress = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
addresses.base.aeroVoterAddress = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
addresses.base.aeroFactoryAddress =
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
addresses.base.aeroGaugeGovernorAddress =
  "0xE6A41fE61E7a1996B59d508661e3f524d6A32075";
addresses.base.aeroQuoterV2Address =
  "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

addresses.base.ethUsdPriceFeed = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";

addresses.base.aeroUsdPriceFeed = "0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0";
addresses.base.WETH = "0x4200000000000000000000000000000000000006";
addresses.base.wethAeroPoolAddress =
  "0x80aBe24A3ef1fc593aC5Da960F232ca23B2069d0";
addresses.base.governor = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
// 2/8 Multisig
addresses.base.strategist = "0x28bce2eE5775B652D92bB7c2891A89F036619703";
addresses.base.timelock = "0xf817cb3092179083c48c014688D98B72fB61464f";
addresses.base.multichainStrategist =
  "0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971";

// Chainlink: https://data.chain.link/feeds/base/base/woeth-oeth-exchange-rate
addresses.base.BridgedWOETHOracleFeed =
  "0xe96EB1EDa83d18cbac224233319FA5071464e1b9";

// Base Aerodrome
addresses.base.nonFungiblePositionManager =
  "0x827922686190790b37229fd06084350E74485b72";
addresses.base.slipstreamPoolFactory =
  "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
addresses.base.aerodromeOETHbWETHClPool =
  "0x6446021F4E396dA3df4235C62537431372195D38";
addresses.base.aerodromeOETHbWETHClGauge =
  "0xdD234DBe2efF53BED9E8fC0e427ebcd74ed4F429";
addresses.base.swapRouter = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
addresses.base.sugarHelper = "0x0AD09A66af0154a84e86F761313d02d0abB6edd5";
addresses.base.quoterV2 = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

addresses.base.oethbBribesContract =
  "0x685ce0e36ca4b81f13b7551c76143d962568f6dd";

addresses.base.OZRelayerAddress = "0xc0D6fa24D135c006dE5B8b2955935466A03D920a";

// Base Curve
addresses.base.CRV = "0x8Ee73c484A26e0A5df2Ee2a4960B789967dd0415";
addresses.base.OETHb_WETH = {};
addresses.base.OETHb_WETH.pool = "0x302A94E3C28c290EAF2a4605FC52e11Eb915f378";
addresses.base.OETHb_WETH.gauge = "0x9da8420dbEEBDFc4902B356017610259ef7eeDD8";
addresses.base.childLiquidityGaugeFactory =
  "0xe35A879E5EfB4F1Bb7F70dCF3250f2e19f096bd8";

addresses.base.CCIPRouter = "0x881e3A65B4d4a04dD529061dd0071cf975F58bCD";

addresses.base.MerklDistributor = "0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd";

// Sonic
addresses.sonic.wS = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";
addresses.sonic.WETH = "0x309C92261178fA0CF748A855e90Ae73FDb79EBc7";
addresses.sonic.SFC = "0xFC00FACE00000000000000000000000000000000";
addresses.sonic.nodeDriver = "0xd100a01e00000000000000000000000000000001";
addresses.sonic.nodeDriveAuth = "0xd100ae0000000000000000000000000000000000";
addresses.sonic.validatorRegistrator =
  "0x531B8D5eD6db72A56cF1238D4cE478E7cB7f2825";
// 5/8 Multisig - formally known as the Governor but not to be confused with the Governor contract
addresses.sonic.admin = "0xAdDEA7933Db7d83855786EB43a238111C69B00b6";
// 2/8 Multisig - formally known as the Strategist
addresses.sonic.guardian = "0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a";
addresses.sonic.timelock = "0x31a91336414d3B955E494E7d485a6B06b55FC8fB";

addresses.sonic.OSonicProxy = "0xb1e25689D55734FD3ffFc939c4C3Eb52DFf8A794";
addresses.sonic.WOSonicProxy = "0x9F0dF7799f6FDAd409300080cfF680f5A23df4b1";
addresses.sonic.OSonicVaultProxy = "0xa3c0eCA00D2B76b4d1F170b0AB3FdeA16C180186";
addresses.sonic.SonicStakingStrategy =
  "0x596B0401479f6DfE1cAF8c12838311FeE742B95c";

// SwapX on Sonic
addresses.sonic.SWPx = "0xA04BC7140c26fc9BB1F36B1A604C7A5a88fb0E70";
addresses.sonic.SwapXOwner = "0xAdB5A1518713095C39dBcA08Da6656af7249Dd20";
addresses.sonic.SwapXVoter = "0xC1AE2779903cfB84CB9DEe5c03EcEAc32dc407F2";
addresses.sonic.SwapXSWPxOSPool = "0x9Cb484FAD38D953bc79e2a39bBc93655256F0B16";
addresses.sonic.SwapXTreasury = "0x896c3f0b63a8DAE60aFCE7Bca73356A9b611f3c8";
addresses.sonic.SwapXOsUSDCe = {};
addresses.sonic.SwapXOsUSDCe.pool =
  "0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96";
addresses.sonic.SwapXOsUSDCe.gaugeOS =
  "0x737938a25D811A3F324aC0257d75b5e88d0a6FC3";
addresses.sonic.SwapXOsUSDCe.extBribeOS =
  "0x41688C9bb59ce191F6BB57c5829ac9D50A03E410";
addresses.sonic.SwapXOsUSDCe.gaugeUSDC =
  "0xB660B984F80a89044Aa3841F1a1C78B2F596393f";
addresses.sonic.SwapXOsUSDCe.extBribeUSDC =
  "0xBCF88f38865B7712da4DE0a8eFC286C601CAE5e7";

addresses.sonic.SwapXOsGEMSx = {};
addresses.sonic.SwapXOsGEMSx.pool =
  "0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5";

addresses.sonic.SwapXWSOS = {};
addresses.sonic.SwapXWSOS.pool = "0xcfE67b6c7B65c8d038e666b3241a161888B7f2b0";
addresses.sonic.SwapXWSOS.gauge = "0x083D761B2A3e1fb5914FA61c6Bf11A93dcb60709";

addresses.sonic.SwapXOsUSDCeMultisigBooster =
  "0x4636269e7CDc253F6B0B210215C3601558FE80F6";
addresses.sonic.SwapXOsGEMSxMultisigBooster =
  "0xE2c01Cc951E8322992673Fa2302054375636F7DE";

addresses.sonic.Equalizer = {};
addresses.sonic.Equalizer.WsOs = {};
addresses.sonic.Equalizer.WsOs.pool =
  "0x99ff9d3E8B26Fea85a7a103D9e576EfdC38fB530";
addresses.sonic.Equalizer.WsOs.extBribeOS =
  "0x2726Be050f22B9aFF2b582758aeEa504cDa6fA62";
addresses.sonic.Equalizer.ThcOs = {};
addresses.sonic.Equalizer.ThcOs.pool =
  "0xd6f5d565410c536e3e9C4FCf05560518C2C56440";
addresses.sonic.Equalizer.ThcOs.extBribeOS =
  "0x9e566ce25A90A07125b7c697ca8f01bbC41Cb3B3";

addresses.sonic.SwapX = {};
addresses.sonic.SwapX.OsSfrxUSD = {};
addresses.sonic.SwapX.OsSfrxUSD.pool =
  "0x9255F31eF9B35d085cED6fE29F9E077EB1f513C6";
addresses.sonic.SwapX.OsSfrxUSD.gaugeOS =
  "0x99d8E114F1a6359c6048Ae5Cce163786c0Ce97DF";
addresses.sonic.SwapX.OsSfrxUSD.extBribeOS =
  "0xb7A1a8AC3Cb1a40bbE73894c0b5e911d3a1ac075";
addresses.sonic.SwapX.OsSfrxUSD.gaugeOther =
  "0x88d6c63f1EF23bDff2bD483831074dc23d8416d4";
addresses.sonic.SwapX.OsSfrxUSD.extBribeOther =
  "0xD1ECb64C0C20F2500a259DF4d125d0e21Eaa24cD";
addresses.sonic.SwapX.OsScUSD = {};
addresses.sonic.SwapX.OsScUSD.pool =
  "0x370428430503b3b5970ccaf530cbc71d02c3b61a";
addresses.sonic.SwapX.OsScUSD.gaugeOS =
  "0x23bDc38a3bA72DE7B32A1bC01DFfB99Ce4CF8b2b";
addresses.sonic.SwapX.OsScUSD.extBribeOS =
  "0xF22ea5dEE8FC4A12Dd4263448e2c1C2494c1E6f4";
addresses.sonic.SwapX.OsScUSD.gaugeOther =
  "0x1FFCD52e4E452F35a92ED58CE94629E8d9DC09CF";
addresses.sonic.SwapX.OsScUSD.extBribeOther =
  "0xBD365648bEbe932f8394F726D4A83FBd684E6b72";
addresses.sonic.SwapX.OsSilo = {};
addresses.sonic.SwapX.OsSilo.pool =
  "0x2ab09e10F75965Ccc369C8B86071f351141Dc0a1";
addresses.sonic.SwapX.OsSilo.gaugeOS =
  "0x016889e5E0F026c030D28321f3190A39206120AD";
addresses.sonic.SwapX.OsSilo.extBribeOS =
  "0x91BF8dc9D93ed1aC1aFaD78bB9B48F04bDF01F36";
addresses.sonic.SwapX.OsSilo.gaugeOther =
  "0x6e4e2e895223f62Cc53bA56128a58bC58D79BEa0";
addresses.sonic.SwapX.OsSilo.extBribeOther =
  "0xe0fd09bae2A254e19fc75fCEC967a373E0b63909";
addresses.sonic.SwapX.OsFiery = {};
addresses.sonic.SwapX.OsFiery.pool =
  "0xc3a185226d594b56d3e5cf52308d07fe972ca769";
addresses.sonic.SwapX.OsFiery.gaugeOS =
  "0xBb3cFc4f69ecfaeb9fd4d263bD8549C8CCFd25d7";
addresses.sonic.SwapX.OsFiery.extBribeOS =
  "0x5ee96bE5747867560D18F042991E045401601b01";
addresses.sonic.SwapX.OsHedgy = {};
addresses.sonic.SwapX.OsHedgy.pool =
  "0x1695d6bd8d8adc8b87c6204be34d34d19a3fe1d6";
addresses.sonic.SwapX.OsHedgy.yf_treasury =
  "0x4c884677427a975d1b99286e99188c82d71223c8";
addresses.sonic.SwapX.OsMYRD = {};
addresses.sonic.SwapX.OsMYRD.pool =
  "0x6228739b26f49ae9cd953d82366934e209175e81";
addresses.sonic.SwapX.OsMYRD.gaugeOS =
  "0xA9Bb2b8B92a546a53466B5E7d8D8f2F03032FB41";
addresses.sonic.SwapX.OsMYRD.extBribeOS =
  "0x5599bfd59a9EE0E8b65aB2d2449F4bdf28c75edc";
addresses.sonic.SwapX.OsBes = {};
addresses.sonic.SwapX.OsBes.pool = "0x97fe831cc56da84321f404a300e2be81b5bd668a";
addresses.sonic.SwapX.OsBes.gaugeOS =
  "0x77546B40445d3eca6111944DFe902de0514A4F80";
addresses.sonic.SwapX.OsBes.extBribeOS =
  "0x19582ff8ffD7695eE177061eb4AC3fCA520F3638";
addresses.sonic.SwapX.OsBes.gaugeOther =
  "0xfBA3606310f3d492031176eC85DFbeD67F5799F2";
addresses.sonic.SwapX.OsBes.extBribeOther =
  "0x298B8934bC89d19F89A1F8Eb620659E6678e3539";
addresses.sonic.SwapX.OsBRNx = {};
addresses.sonic.SwapX.OsBRNx.pool =
  "0x12dAb9825B85B07f8DdDe746066B7Ed6Bc4c06F8";
addresses.sonic.SwapX.OsBRNx.gaugeOS =
  "0xBd896eB3503A2eC0f246B3C0B7D8D434F7c697Fc";
addresses.sonic.SwapX.OsBRNx.extBribeOS =
  "0x0B2d62B1B025751249543d47765f55a66Dd526c7";
addresses.sonic.SwapX.OsBRNx.gaugeOther =
  "0xaE519dE817775E394Fc854d966065a97Facfc934";
addresses.sonic.SwapX.OsBRNx.extBribeOther =
  "0xC9FA26E55e92e1D9c63A6FDF9b91FaC794523203";

// Sonic Shadow
addresses.sonic.Shadow = {};
addresses.sonic.Shadow.OsEco = {};
addresses.sonic.Shadow.OsEco.pool =
  "0xfd0cee796348fd99ab792c471f4419b4c56cf6b8";
addresses.sonic.Shadow.OsEco.yf_treasury =
  "0x4b9919603170c77936d8ec2c08b604844e861699";

// Sonic Metropolis
addresses.sonic.Metropolis = {};
addresses.sonic.Metropolis.Voter = "0x03A9896A464C515d13f2679df337bF95bc891fdA";
addresses.sonic.Metropolis.RewarderFactory =
  "0xd9db92613867FE0d290CE64Fe737E2F8B80CADc3";
addresses.sonic.Metropolis.Pools = {};
addresses.sonic.Metropolis.Pools.OsWOs =
  "0x3987a13d675c66570bc28c955685a9bca2dcf26e";
addresses.sonic.Metropolis.Pools.OsMoon =
  "0xc0aac9bb9fb72a77e3bc8bee46d3e227c84a54c0";
addresses.sonic.Metropolis.OsWs = {};
addresses.sonic.Metropolis.OsWs.pool =
  "0x3987a13d675c66570bc28c955685a9bca2dcf26e";

// Sonic Curve
addresses.sonic.CRV = "0x5Af79133999f7908953E94b7A5CF367740Ebee35";
addresses.sonic.WS_OS = {};
addresses.sonic.WS_OS.pool = "0x7180F41A71f13FaC52d2CfB17911f5810c8B0BB9";
addresses.sonic.WS_OS.gauge = "0x9CA6dE419e9fc7bAC876DE07F0f6Ec96331Ba207";
addresses.sonic.childLiquidityGaugeFactory =
  "0xf3A431008396df8A8b2DF492C913706BDB0874ef";

// Sonic Merkl
addresses.sonic.MerklDistributor = "0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd";

// Holesky
addresses.holesky.WETH = "0x94373a4919B3240D86eA41593D5eBa789FEF3848";

// SSV network
addresses.holesky.SSV = "0xad45A78180961079BFaeEe349704F411dfF947C6";
addresses.holesky.SSVNetwork = "0x38A4794cCEd47d3baf7370CcC43B560D3a1beEFA";
addresses.holesky.beaconChainDepositContract =
  "0x4242424242424242424242424242424242424242";

// Native Staking Strategy
addresses.holesky.NativeStakingSSVStrategyProxy =
  "0xcf4a9e80Ddb173cc17128A361B98B9A140e3932E";

addresses.holesky.OETHVaultProxy = "0x19d2bAaBA949eFfa163bFB9efB53ed8701aA5dD9";

addresses.holesky.Governor = "0x1b94CA50D3Ad9f8368851F8526132272d1a5028C";
// Address of the Holesky defender relayer
addresses.holesky.validatorRegistrator =
  "0x3C6B0c7835a2E2E0A45889F64DcE4ee14c1D5CB4";
// Address of the Holesky defender relayer
addresses.holesky.Guardian = "0x3C6B0c7835a2E2E0A45889F64DcE4ee14c1D5CB4";

addresses.plume.WETH = "0xca59cA09E5602fAe8B629DeE83FfA819741f14be";
addresses.plume.BridgedWOETH = "0xD8724322f44E5c58D7A815F542036fb17DbbF839";
addresses.plume.LayerZeroEndpointV2 =
  "0xC1b15d3B262bEeC0e3565C11C9e0F6134BdaCB36";
addresses.plume.WOETHOmnichainAdapter =
  "0x592CB6A596E7919930bF49a27AdAeCA7C055e4DB";
addresses.plume.WETHOmnichainAdapter =
  "0x4683CE822272CD66CEa73F5F1f9f5cBcaEF4F066";

addresses.plume.timelock = "0x6C6f8F839A7648949873D3D2beEa936FC2932e5c";
addresses.plume.WPLUME = "0xEa237441c92CAe6FC17Caaf9a7acB3f953be4bd1";
addresses.plume.MaverickV2Factory =
  "0x056A588AfdC0cdaa4Cab50d8a4D2940C5D04172E";
addresses.plume.MaverickV2PoolLens =
  "0x15B4a8cc116313b50C19BCfcE4e5fc6EC8C65793";
addresses.plume.MaverickV2Quoter = "0xf245948e9cf892C351361d298cc7c5b217C36D82";
addresses.plume.MaverickV2Router = "0x35e44dc4702Fd51744001E248B49CBf9fcc51f0C";
addresses.plume.MaverickV2Position =
  "0x0b452E8378B65FD16C0281cfe48Ed9723b8A1950";
addresses.plume.MaverickV2LiquidityManager =
  "0x28d79eddBF5B215cAccBD809B967032C1E753af7";
addresses.plume.OethpWETHRoosterPool =
  "0x3F86B564A9B530207876d2752948268b9Bf04F71";
addresses.plume.strategist = addresses.multichainStrategist;
addresses.plume.admin = "0x92A19381444A001d62cE67BaFF066fA1111d7202";

// Ref: https://docs.eo.app/docs/eprice/feed-addresses/plume
addresses.plume.BridgedWOETHOracleFeed =
  "0x4915600Ed7d85De62011433eEf0BD5399f677e9b";

addresses.hoodi = {};
addresses.hoodi.WETH = "0x2387fD72C1DA19f6486B843F5da562679FbB4057";
addresses.hoodi.SSV = "0x9F5d4Ec84fC4785788aB44F9de973cF34F7A038e";
addresses.hoodi.SSVNetwork = "0x58410Bef803ECd7E63B23664C586A6DB72DAf59c";
addresses.hoodi.beaconChainDepositContract =
  "0x00000000219ab540356cBB839Cbe05303d7705Fa";
addresses.hoodi.defenderRelayer = "0x419B6BdAE482f41b8B194515749F3A2Da26d583b";
addresses.hoodi.mockBeaconRoots = "0xdCfcAE4A084AA843eE446f400B23aA7B6340484b";

var src = {exports: {}};

var browser = {exports: {}};

/**
 * Helpers.
 */

var ms;
var hasRequiredMs;

function requireMs () {
	if (hasRequiredMs) return ms;
	hasRequiredMs = 1;
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;

	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */

	ms = function(val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isFinite(val)) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};

	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */

	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'weeks':
	    case 'week':
	    case 'w':
	      return n * w;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtShort(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (msAbs >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (msAbs >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (msAbs >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}

	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtLong(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return plural(ms, msAbs, d, 'day');
	  }
	  if (msAbs >= h) {
	    return plural(ms, msAbs, h, 'hour');
	  }
	  if (msAbs >= m) {
	    return plural(ms, msAbs, m, 'minute');
	  }
	  if (msAbs >= s) {
	    return plural(ms, msAbs, s, 'second');
	  }
	  return ms + ' ms';
	}

	/**
	 * Pluralization helper.
	 */

	function plural(ms, msAbs, n, name) {
	  var isPlural = msAbs >= n * 1.5;
	  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
	}
	return ms;
}

var common;
var hasRequiredCommon;

function requireCommon () {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 */

	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = requireMs();
		createDebug.destroy = destroy;

		Object.keys(env).forEach(key => {
			createDebug[key] = env[key];
		});

		/**
		* The currently active debug mode names, and names to skip.
		*/

		createDebug.names = [];
		createDebug.skips = [];

		/**
		* Map of special "%n" handling functions, for the debug "format" argument.
		*
		* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		*/
		createDebug.formatters = {};

		/**
		* Selects a color for a debug namespace
		* @param {String} namespace The namespace string for the debug instance to be colored
		* @return {Number|String} An ANSI color code for the given namespace
		* @api private
		*/
		function selectColor(namespace) {
			let hash = 0;

			for (let i = 0; i < namespace.length; i++) {
				hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
				hash |= 0; // Convert to 32bit integer
			}

			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;

		/**
		* Create a debugger with the given `namespace`.
		*
		* @param {String} namespace
		* @return {Function}
		* @api public
		*/
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;

			function debug(...args) {
				// Disabled?
				if (!debug.enabled) {
					return;
				}

				const self = debug;

				// Set `diff` timestamp
				const curr = Number(new Date());
				const ms = curr - (prevTime || curr);
				self.diff = ms;
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;

				args[0] = createDebug.coerce(args[0]);

				if (typeof args[0] !== 'string') {
					// Anything else let's inspect with %O
					args.unshift('%O');
				}

				// Apply any `formatters` transformations
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					// If we encounter an escaped % then don't increase the array index
					if (match === '%%') {
						return '%';
					}
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === 'function') {
						const val = args[index];
						match = formatter.call(self, val);

						// Now we need to remove `args[index]` since it's inlined in the `format`
						args.splice(index, 1);
						index--;
					}
					return match;
				});

				// Apply env-specific formatting (colors, etc.)
				createDebug.formatArgs.call(self, args);

				const logFn = self.log || createDebug.log;
				logFn.apply(self, args);
			}

			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

			Object.defineProperty(debug, 'enabled', {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) {
						return enableOverride;
					}
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}

					return enabledCache;
				},
				set: v => {
					enableOverride = v;
				}
			});

			// Env-specific initialization logic for debug instances
			if (typeof createDebug.init === 'function') {
				createDebug.init(debug);
			}

			return debug;
		}

		function extend(namespace, delimiter) {
			const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
			newDebug.log = this.log;
			return newDebug;
		}

		/**
		* Enables a debug mode by namespaces. This can include modes
		* separated by a colon and wildcards.
		*
		* @param {String} namespaces
		* @api public
		*/
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;

			createDebug.names = [];
			createDebug.skips = [];

			let i;
			const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
			const len = split.length;

			for (i = 0; i < len; i++) {
				if (!split[i]) {
					// ignore empty strings
					continue;
				}

				namespaces = split[i].replace(/\*/g, '.*?');

				if (namespaces[0] === '-') {
					createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
				} else {
					createDebug.names.push(new RegExp('^' + namespaces + '$'));
				}
			}
		}

		/**
		* Disable debug output.
		*
		* @return {String} namespaces
		* @api public
		*/
		function disable() {
			const namespaces = [
				...createDebug.names.map(toNamespace),
				...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
			].join(',');
			createDebug.enable('');
			return namespaces;
		}

		/**
		* Returns true if the given mode name is enabled, false otherwise.
		*
		* @param {String} name
		* @return {Boolean}
		* @api public
		*/
		function enabled(name) {
			if (name[name.length - 1] === '*') {
				return true;
			}

			let i;
			let len;

			for (i = 0, len = createDebug.skips.length; i < len; i++) {
				if (createDebug.skips[i].test(name)) {
					return false;
				}
			}

			for (i = 0, len = createDebug.names.length; i < len; i++) {
				if (createDebug.names[i].test(name)) {
					return true;
				}
			}

			return false;
		}

		/**
		* Convert regexp to namespace
		*
		* @param {RegExp} regxep
		* @return {String} namespace
		* @api private
		*/
		function toNamespace(regexp) {
			return regexp.toString()
				.substring(2, regexp.toString().length - 2)
				.replace(/\.\*\?$/, '*');
		}

		/**
		* Coerce `val`.
		*
		* @param {Mixed} val
		* @return {Mixed}
		* @api private
		*/
		function coerce(val) {
			if (val instanceof Error) {
				return val.stack || val.message;
			}
			return val;
		}

		/**
		* XXX DO NOT USE. This is a temporary stub function.
		* XXX It WILL be removed in the next major release.
		*/
		function destroy() {
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}

		createDebug.enable(createDebug.load());

		return createDebug;
	}

	common = setup;
	return common;
}

/* eslint-env browser */

var hasRequiredBrowser;

function requireBrowser () {
	if (hasRequiredBrowser) return browser.exports;
	hasRequiredBrowser = 1;
	(function (module, exports) {
		/**
		 * This is the web browser implementation of `debug()`.
		 */

		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.storage = localstorage();
		exports.destroy = (() => {
			let warned = false;

			return () => {
				if (!warned) {
					warned = true;
					console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
				}
			};
		})();

		/**
		 * Colors.
		 */

		exports.colors = [
			'#0000CC',
			'#0000FF',
			'#0033CC',
			'#0033FF',
			'#0066CC',
			'#0066FF',
			'#0099CC',
			'#0099FF',
			'#00CC00',
			'#00CC33',
			'#00CC66',
			'#00CC99',
			'#00CCCC',
			'#00CCFF',
			'#3300CC',
			'#3300FF',
			'#3333CC',
			'#3333FF',
			'#3366CC',
			'#3366FF',
			'#3399CC',
			'#3399FF',
			'#33CC00',
			'#33CC33',
			'#33CC66',
			'#33CC99',
			'#33CCCC',
			'#33CCFF',
			'#6600CC',
			'#6600FF',
			'#6633CC',
			'#6633FF',
			'#66CC00',
			'#66CC33',
			'#9900CC',
			'#9900FF',
			'#9933CC',
			'#9933FF',
			'#99CC00',
			'#99CC33',
			'#CC0000',
			'#CC0033',
			'#CC0066',
			'#CC0099',
			'#CC00CC',
			'#CC00FF',
			'#CC3300',
			'#CC3333',
			'#CC3366',
			'#CC3399',
			'#CC33CC',
			'#CC33FF',
			'#CC6600',
			'#CC6633',
			'#CC9900',
			'#CC9933',
			'#CCCC00',
			'#CCCC33',
			'#FF0000',
			'#FF0033',
			'#FF0066',
			'#FF0099',
			'#FF00CC',
			'#FF00FF',
			'#FF3300',
			'#FF3333',
			'#FF3366',
			'#FF3399',
			'#FF33CC',
			'#FF33FF',
			'#FF6600',
			'#FF6633',
			'#FF9900',
			'#FF9933',
			'#FFCC00',
			'#FFCC33'
		];

		/**
		 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
		 * and the Firebug extension (any Firefox version) are known
		 * to support "%c" CSS customizations.
		 *
		 * TODO: add a `localStorage` variable to explicitly enable/disable colors
		 */

		// eslint-disable-next-line complexity
		function useColors() {
			// NB: In an Electron preload script, document will be defined but not fully
			// initialized. Since we know we're in Chrome, we'll just detect this case
			// explicitly
			if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
				return true;
			}

			// Internet Explorer and Edge do not support colors.
			if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
				return false;
			}

			// Is webkit? http://stackoverflow.com/a/16459606/376773
			// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
			return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
				// Is firebug? http://stackoverflow.com/a/398120/376773
				(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
				// Is firefox >= v31?
				// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
				(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
				// Double check webkit in userAgent just in case we are in a worker
				(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
		}

		/**
		 * Colorize log arguments if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
			args[0] = (this.useColors ? '%c' : '') +
				this.namespace +
				(this.useColors ? ' %c' : ' ') +
				args[0] +
				(this.useColors ? '%c ' : ' ') +
				'+' + module.exports.humanize(this.diff);

			if (!this.useColors) {
				return;
			}

			const c = 'color: ' + this.color;
			args.splice(1, 0, c, 'color: inherit');

			// The final "%c" is somewhat tricky, because there could be other
			// arguments passed either before or after the %c, so we need to
			// figure out the correct index to insert the CSS into
			let index = 0;
			let lastC = 0;
			args[0].replace(/%[a-zA-Z%]/g, match => {
				if (match === '%%') {
					return;
				}
				index++;
				if (match === '%c') {
					// We only are interested in the *last* %c
					// (the user may have provided their own)
					lastC = index;
				}
			});

			args.splice(lastC, 0, c);
		}

		/**
		 * Invokes `console.debug()` when available.
		 * No-op when `console.debug` is not a "function".
		 * If `console.debug` is not available, falls back
		 * to `console.log`.
		 *
		 * @api public
		 */
		exports.log = console.debug || console.log || (() => {});

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */
		function save(namespaces) {
			try {
				if (namespaces) {
					exports.storage.setItem('debug', namespaces);
				} else {
					exports.storage.removeItem('debug');
				}
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */
		function load() {
			let r;
			try {
				r = exports.storage.getItem('debug');
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}

			// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
			if (!r && typeof process !== 'undefined' && 'env' in process) {
				r = process.env.DEBUG;
			}

			return r;
		}

		/**
		 * Localstorage attempts to return the localstorage.
		 *
		 * This is necessary because safari throws
		 * when a user disables cookies/localstorage
		 * and you attempt to access it.
		 *
		 * @return {LocalStorage}
		 * @api private
		 */

		function localstorage() {
			try {
				// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
				// The Browser also has localStorage in the global context.
				return localStorage;
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		module.exports = requireCommon()(exports);

		const {formatters} = module.exports;

		/**
		 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
		 */

		formatters.j = function (v) {
			try {
				return JSON.stringify(v);
			} catch (error) {
				return '[UnexpectedJSONParseError]: ' + error.message;
			}
		}; 
	} (browser, browser.exports));
	return browser.exports;
}

var node = {exports: {}};

var hasFlag;
var hasRequiredHasFlag;

function requireHasFlag () {
	if (hasRequiredHasFlag) return hasFlag;
	hasRequiredHasFlag = 1;

	hasFlag = (flag, argv = process.argv) => {
		const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
		const position = argv.indexOf(prefix + flag);
		const terminatorPosition = argv.indexOf('--');
		return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
	};
	return hasFlag;
}

var supportsColor_1;
var hasRequiredSupportsColor;

function requireSupportsColor () {
	if (hasRequiredSupportsColor) return supportsColor_1;
	hasRequiredSupportsColor = 1;
	const os = require$$0;
	const tty = require$$1;
	const hasFlag = requireHasFlag();

	const {env} = process;

	let flagForceColor;
	if (hasFlag('no-color') ||
		hasFlag('no-colors') ||
		hasFlag('color=false') ||
		hasFlag('color=never')) {
		flagForceColor = 0;
	} else if (hasFlag('color') ||
		hasFlag('colors') ||
		hasFlag('color=true') ||
		hasFlag('color=always')) {
		flagForceColor = 1;
	}

	function envForceColor() {
		if ('FORCE_COLOR' in env) {
			if (env.FORCE_COLOR === 'true') {
				return 1;
			}

			if (env.FORCE_COLOR === 'false') {
				return 0;
			}

			return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
		}
	}

	function translateLevel(level) {
		if (level === 0) {
			return false;
		}

		return {
			level,
			hasBasic: true,
			has256: level >= 2,
			has16m: level >= 3
		};
	}

	function supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
		const noFlagForceColor = envForceColor();
		if (noFlagForceColor !== undefined) {
			flagForceColor = noFlagForceColor;
		}

		const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

		if (forceColor === 0) {
			return 0;
		}

		if (sniffFlags) {
			if (hasFlag('color=16m') ||
				hasFlag('color=full') ||
				hasFlag('color=truecolor')) {
				return 3;
			}

			if (hasFlag('color=256')) {
				return 2;
			}
		}

		if (haveStream && !streamIsTTY && forceColor === undefined) {
			return 0;
		}

		const min = forceColor || 0;

		if (env.TERM === 'dumb') {
			return min;
		}

		if (process.platform === 'win32') {
			// Windows 10 build 10586 is the first Windows release that supports 256 colors.
			// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
			const osRelease = os.release().split('.');
			if (
				Number(osRelease[0]) >= 10 &&
				Number(osRelease[2]) >= 10586
			) {
				return Number(osRelease[2]) >= 14931 ? 3 : 2;
			}

			return 1;
		}

		if ('CI' in env) {
			if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
				return 1;
			}

			return min;
		}

		if ('TEAMCITY_VERSION' in env) {
			return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
		}

		if (env.COLORTERM === 'truecolor') {
			return 3;
		}

		if ('TERM_PROGRAM' in env) {
			const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

			switch (env.TERM_PROGRAM) {
				case 'iTerm.app':
					return version >= 3 ? 3 : 2;
				case 'Apple_Terminal':
					return 2;
				// No default
			}
		}

		if (/-256(color)?$/i.test(env.TERM)) {
			return 2;
		}

		if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
			return 1;
		}

		if ('COLORTERM' in env) {
			return 1;
		}

		return min;
	}

	function getSupportLevel(stream, options = {}) {
		const level = supportsColor(stream, {
			streamIsTTY: stream && stream.isTTY,
			...options
		});

		return translateLevel(level);
	}

	supportsColor_1 = {
		supportsColor: getSupportLevel,
		stdout: getSupportLevel({isTTY: tty.isatty(1)}),
		stderr: getSupportLevel({isTTY: tty.isatty(2)})
	};
	return supportsColor_1;
}

/**
 * Module dependencies.
 */

var hasRequiredNode;

function requireNode () {
	if (hasRequiredNode) return node.exports;
	hasRequiredNode = 1;
	(function (module, exports) {
		const tty = require$$1;
		const util = require$$1$1;

		/**
		 * This is the Node.js implementation of `debug()`.
		 */

		exports.init = init;
		exports.log = log;
		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.destroy = util.deprecate(
			() => {},
			'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
		);

		/**
		 * Colors.
		 */

		exports.colors = [6, 2, 3, 4, 5, 1];

		try {
			// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
			// eslint-disable-next-line import/no-extraneous-dependencies
			const supportsColor = requireSupportsColor();

			if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
				exports.colors = [
					20,
					21,
					26,
					27,
					32,
					33,
					38,
					39,
					40,
					41,
					42,
					43,
					44,
					45,
					56,
					57,
					62,
					63,
					68,
					69,
					74,
					75,
					76,
					77,
					78,
					79,
					80,
					81,
					92,
					93,
					98,
					99,
					112,
					113,
					128,
					129,
					134,
					135,
					148,
					149,
					160,
					161,
					162,
					163,
					164,
					165,
					166,
					167,
					168,
					169,
					170,
					171,
					172,
					173,
					178,
					179,
					184,
					185,
					196,
					197,
					198,
					199,
					200,
					201,
					202,
					203,
					204,
					205,
					206,
					207,
					208,
					209,
					214,
					215,
					220,
					221
				];
			}
		} catch (error) {
			// Swallow - we only care if `supports-color` is available; it doesn't have to be.
		}

		/**
		 * Build up the default `inspectOpts` object from the environment variables.
		 *
		 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
		 */

		exports.inspectOpts = Object.keys(process.env).filter(key => {
			return /^debug_/i.test(key);
		}).reduce((obj, key) => {
			// Camel-case
			const prop = key
				.substring(6)
				.toLowerCase()
				.replace(/_([a-z])/g, (_, k) => {
					return k.toUpperCase();
				});

			// Coerce string value into JS value
			let val = process.env[key];
			if (/^(yes|on|true|enabled)$/i.test(val)) {
				val = true;
			} else if (/^(no|off|false|disabled)$/i.test(val)) {
				val = false;
			} else if (val === 'null') {
				val = null;
			} else {
				val = Number(val);
			}

			obj[prop] = val;
			return obj;
		}, {});

		/**
		 * Is stdout a TTY? Colored output is enabled when `true`.
		 */

		function useColors() {
			return 'colors' in exports.inspectOpts ?
				Boolean(exports.inspectOpts.colors) :
				tty.isatty(process.stderr.fd);
		}

		/**
		 * Adds ANSI color escape codes if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
			const {namespace: name, useColors} = this;

			if (useColors) {
				const c = this.color;
				const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
				const prefix = `  ${colorCode};1m${name} \u001B[0m`;

				args[0] = prefix + args[0].split('\n').join('\n' + prefix);
				args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
			} else {
				args[0] = getDate() + name + ' ' + args[0];
			}
		}

		function getDate() {
			if (exports.inspectOpts.hideDate) {
				return '';
			}
			return new Date().toISOString() + ' ';
		}

		/**
		 * Invokes `util.format()` with the specified arguments and writes to stderr.
		 */

		function log(...args) {
			return process.stderr.write(util.format(...args) + '\n');
		}

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */
		function save(namespaces) {
			if (namespaces) {
				process.env.DEBUG = namespaces;
			} else {
				// If you set a process.env field to null or undefined, it gets cast to the
				// string 'null' or 'undefined'. Just delete instead.
				delete process.env.DEBUG;
			}
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */

		function load() {
			return process.env.DEBUG;
		}

		/**
		 * Init logic for `debug` instances.
		 *
		 * Create a new `inspectOpts` object in case `useColors` is set
		 * differently for a particular `debug` instance.
		 */

		function init(debug) {
			debug.inspectOpts = {};

			const keys = Object.keys(exports.inspectOpts);
			for (let i = 0; i < keys.length; i++) {
				debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
			}
		}

		module.exports = requireCommon()(exports);

		const {formatters} = module.exports;

		/**
		 * Map %o to `util.inspect()`, all on a single line.
		 */

		formatters.o = function (v) {
			this.inspectOpts.colors = this.useColors;
			return util.inspect(v, this.inspectOpts)
				.split('\n')
				.map(str => str.trim())
				.join(' ');
		};

		/**
		 * Map %O to `util.inspect()`, allowing multiple lines if needed.
		 */

		formatters.O = function (v) {
			this.inspectOpts.colors = this.useColors;
			return util.inspect(v, this.inspectOpts);
		}; 
	} (node, node.exports));
	return node.exports;
}

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */

if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
	src.exports = requireBrowser();
} else {
	src.exports = requireNode();
}

var srcExports = src.exports;

const debug = srcExports;

// https://www.npmjs.com/package/debug#output-streams
// set all output to go via console.log instead of stderr
// This is needed for Defender Actions to capture the logs
debug.log = console.log.bind(console);

/**
 * Creates a logger for a module.
 * @example
 *   const log = require("../utils/logger")("test:fork:vault");
 *   log('something interesting happened');
 * @param {string} module name of the module to log for. eg "test:fork:vault", "task:token" or "utils:deploy"
 */
const logger = (module) => debug(`origin:${module}`);

var logger_1 = logger;

logger_1("utils:txLogger");

const { Network } = actions;

logger_1("action:doAccounting");

// Entrypoint for the Tenderly Action - do not change the function name
const actionFn = async (context, periodicEvent) => {
  // To access project's storage
  // let value = await context.storage.getStr('MY-KEY')
  // await context.storage.putStr('MY-KEY', 'MY-VALUE')
  console.log("Network.MAINNET", Network.MAINNET);
  const defaultGatewayURL = context.gateways.getGateway(Network.MAINNET);
  console.log("defaultGatewayURL", defaultGatewayURL);
  console.log(periodicEvent);

  const provider = new ethers.providers.JsonRpcProvider(
    defaultGatewayURL
  );

  const secret = await context.secrets.get('ACTION_PK')
  const wallet = new Wallet(secret, provider);


  // console.log(
  //   `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  // );

  // // Initialize defender relayer provider and signer
  // let signer

  // const network = await provider.getNetwork();
  // const networkName = network.chainId === 1 ? "mainnet" : "holesky";
  // console.log(`Network: ${networkName} with chain id (${network.chainId})`);
  // log(`Network: ${networkName} with chain id (${network.chainId})`);

  // // await doAccounting("NativeStakingSSVStrategyProxy", networkName, signer);
  // await doAccounting("NativeStakingSSVStrategy2Proxy", networkName, signer);
  // //await doAccounting("NativeStakingSSVStrategy3Proxy", networkName, signer);
};

var doAccounting_1 = { actionFn };

var doAccounting = /*@__PURE__*/getDefaultExportFromCjs(doAccounting_1);

module.exports = doAccounting;
