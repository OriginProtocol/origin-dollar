/* IMPORTANT these are duplicated in `dapp/src/constants/contractAddresses` changes here should
 * also be done there.
 */

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";
addresses.ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

addresses.mainnet = {};

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
  "0xEADB3840596cabF312F2bC88A4Bb0b93A4E1FF5F";

// Native stablecoins
addresses.mainnet.DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
addresses.mainnet.USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
addresses.mainnet.USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
addresses.mainnet.TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
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
addresses.mainnet.CRV = "0xd533a949740bb3306d119cc777fa900ba034cd52";
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

// WETH Token
addresses.mainnet.WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// Deployed OUSD contracts
addresses.mainnet.Guardian = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899"; // ERC 20 owner multisig.
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
addresses.mainnet.CurveOUSDGauge = "0x25f0cE4E2F8dbA112D9b115710AC297F816087CD";

// Curve OETH/ETH pool
addresses.mainnet.ConvexOETHAMOStrategy =
  "0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63";
addresses.mainnet.CurveOETHMetaPool =
  "0x94B17476A93b3262d87B9a326965D1E91f9c13E7";
addresses.mainnet.CurveOETHGauge = "0xd03BE91b1932715709e18021734fcB91BB431715";
addresses.mainnet.CVXETHRewardsPool =
  "0x24b65DC1cf053A8D96872c323d29e86ec43eB33A";

// Morpho
addresses.mainnet.MorphoStrategyProxy =
  "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D";
addresses.mainnet.MorphoAaveStrategyProxy =
  "0x79F2188EF9350A1dC11A062cca0abE90684b0197";
addresses.mainnet.HarvesterProxy = "0x21Fb5812D70B3396880D30e90D9e5C1202266c89";

addresses.mainnet.UniswapOracle = "0xc15169Bad17e676b3BaDb699DEe327423cE6178e";
addresses.mainnet.CompensationClaims =
  "0x9C94df9d594BA1eb94430C006c269C314B1A8281";
addresses.mainnet.Flipper = "0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70";

// Morpho
addresses.mainnet.Morpho = "0x8888882f8f843896699869179fB6E4f7e3B58888";
addresses.mainnet.MorphoLens = "0x930f1b46e1d081ec1524efd95752be3ece51ef67";

// OUSD Governance
addresses.mainnet.GovernorFive = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
addresses.mainnet.Timelock = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
addresses.mainnet.OldTimelock = "0x72426BA137DEC62657306b12B1E869d43FeC6eC7";

// OETH
addresses.mainnet.OETHProxy = "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3";
addresses.mainnet.WOETHProxy = "0xDcEe70654261AF21C44c093C300eD3Bb97b78192";
addresses.mainnet.OETHVaultProxy = "0x39254033945aa2e4809cc2977e7087bee48bd7ab";
addresses.mainnet.OETHZapper = "0x9858e47BCbBe6fBAC040519B02d7cd4B2C470C66";
addresses.mainnet.FraxETHStrategy =
  "0x3ff8654d633d4ea0fae24c52aec73b4a20d0d0e5";
addresses.mainnet.OETHHarvesterProxy =
  "0x0D017aFA83EAce9F10A8EC5B6E13941664A6785C";

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

// Flux Strategy
addresses.mainnet.fDAI = "0xe2bA8693cE7474900A045757fe0efCa900F6530b";
addresses.mainnet.fUSDC = "0x465a5a630482f3abD6d3b84B39B29b07214d19e5";
addresses.mainnet.fUSDT = "0x81994b9607e06ab3d5cF3AffF9a67374f05F27d7";

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

module.exports = addresses;
