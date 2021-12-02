/* IMPORTANT these are duplicated in `dapp/src/constants/contractAddresses` changes here should
 * also be done there.
 */

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";

addresses.mainnet = {};

addresses.mainnet.Binance = "0xf977814e90da44bfa03b6295a0616a897441acec";
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
addresses.mainnet.BinanceAll =
  "0x564286362092d8e7936f0549571a803b203aaced,0xbe0eb53f46cd790cd13851d5eff43d12404d33e8,0xf977814e90da44bfa03b6295a0616a897441acec,0x28c6c06298d514db089934071355e5743bf21d60,0xdfd5293d8e347dfe59e90efd55b2956a1343963d,0x56eddb7aa87536c09ccc2793473599fd21a8b17f,0x21a31ee1afc51d94c2efccaa2092ad1028285549,0x9696f59e4d72e237be84ffd425dcad154bf96976,0x001866ae5b3de6caa5a51543fd9fb64f524f5478,0xab83d182f3485cf1d6ccdd34c7cfef95b4c08da4,0x8b99f3660622e21f2910ecca7fbe51d654a1517d,0x4d9ff50ef4da947364bb9650892b2554e7be5e2b,0xb8c77482e45f1f44de1745f52c74426c631bdd52,0x61189da79177950a7272c88c6058b96d4bcd6be2,0x0681d8db095565fe8a346fa0277bffde9c0edbbf,0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67,0x85b931a32a0725be14285b66f1a22178c672d69b,0x8f22f2063d253846b53609231ed80fa571bc0c8f,0xe0f0cfde7ee664943906f17f7f14342e76a5cec7,0x708396f17127c42383e3b9014072679b2f60b82f,0xd551234ae421e3bcba99a0da6d736074f22192ff,0xfe9e8709d3215310075d67e3ed32a380ccf451c8,0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be";

// Native stablecoins
addresses.mainnet.DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
addresses.mainnet.USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
addresses.mainnet.USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
addresses.mainnet.TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
// AAVE
addresses.mainnet.AAVE_ADDRESS_PROVIDER =
  "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5"; // v2
addresses.mainnet.Aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"; // v1-v2
addresses.mainnet.aTUSD = "--"; // Todo: use v2
addresses.mainnet.aUSDT = "--"; // Todo: use v2
addresses.mainnet.aDAI = "0x028171bca77440897b824ca71d1c56cac55b68a3"; // v2
addresses.mainnet.aUSDC = "--"; // Todo: use v2
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
addresses.mainnet.ThreePoolToken = "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490";
addresses.mainnet.ThreePoolGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
// CVX
addresses.mainnet.CVX = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";
addresses.mainnet.CRVRewardsPool = "0x689440f2ff927e1f24c72f1087e1faf471ece1c8";
addresses.mainnet.CVXBooster = "0xF403C135812408BFbE8713b5A23a04b3D48AAE31";
// Open Oracle
addresses.mainnet.openOracle = "0x922018674c12a7f0d394ebeef9b58f186cde13c1";
// OGN
addresses.mainnet.OGN = "0x8207c1ffc5b6804f6024322ccf34f29c3541ae26";

// Uniswap router
addresses.mainnet.uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
addresses.mainnet.uniswapV3Router =
  "0xe592427a0aece92de3edee1f18e0157c05861564";
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
addresses.mainnet.chainlinkOGN_ETH =
  "0x2c881B6f3f6B5ff6C975813F87A4dad0b241C15b";
// DEPRECATED Chainlink
addresses.mainnet.chainlinkDAI_ETH =
  "0x773616E4d11A78F511299002da57A0a94577F1f4";
addresses.mainnet.chainlinkUSDC_ETH =
  "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
addresses.mainnet.chainlinkUSDT_ETH =
  "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";

// WETH Token
addresses.mainnet.WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// Deployed OUSD contracts
addresses.mainnet.Guardian = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899"; // ERC 20 owner multisig.
addresses.mainnet.VaultProxy = "0x277e80f3E14E7fB3fc40A9d6184088e0241034bD";
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

addresses.mainnet.MixOracle = "0x4d4f5e7a1FE57F5cEB38BfcE8653EFFa5e584458";
addresses.mainnet.UniswapOracle = "0xc15169Bad17e676b3BaDb699DEe327423cE6178e";
addresses.mainnet.CompensationClaims =
  "0x9C94df9d594BA1eb94430C006c269C314B1A8281";
addresses.mainnet.Flipper = "0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70";

/* --- RINKEBY --- */
addresses.rinkeby = {};

addresses.rinkeby.OGN = "0xA115e16ef6e217f7a327a57031F75cE0487AaDb8";

// Compound
addresses.rinkeby.cDAI = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
addresses.rinkeby.cUSDC = "0x5b281a6dda0b271e91ae35de655ad301c976edb1";
addresses.rinkeby.cUSDT = "0x2fb298bdbef468638ad6653ff8376575ea41e768";

module.exports = addresses;
