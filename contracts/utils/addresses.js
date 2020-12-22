/* IMPORTANT these are duplicated in `dapp/src/constants/contractAddresses` changes here should
 * also be done there.
 */

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";

addresses.mainnet = {};
// Native stablecoins
addresses.mainnet.Binance = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";
addresses.mainnet.DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
addresses.mainnet.USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
addresses.mainnet.USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
addresses.mainnet.TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
// AAVE
addresses.mainnet.AAVE_ADDRESS_PROVIDER =
  "0x24a42fD28C976A61Df5D00D0599C34c4f90748c8";
addresses.mainnet.Aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
addresses.mainnet.aTUSD = "0x4DA9b813057D04BAef4e5800E36083717b4a0341";
addresses.mainnet.aUSDT = "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8";
addresses.mainnet.aDAI = "0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d";
addresses.mainnet.aUSDC = "0x9bA00D6856a4eDF4665BcA2C2309936572473B7E";

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
// Open Oracle
addresses.mainnet.openOracle = "0x922018674c12a7f0d394ebeef9b58f186cde13c1";
// OGN
addresses.mainnet.OGN = "0x8207c1ffc5b6804f6024322ccf34f29c3541ae26";

// Uniswap router
addresses.mainnet.uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
// Chainlink feeds
addresses.mainnet.chainlinkETH_USD =
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
addresses.mainnet.chainlinkDAI_ETH =
  "0x773616E4d11A78F511299002da57A0a94577F1f4";
addresses.mainnet.chainlinkUSDC_ETH =
  "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
addresses.mainnet.chainlinkUSDT_ETH =
  "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";
// WETH Token
addresses.mainnet.WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// Deployed OUSD contracts
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
addresses.mainnet.ChainlinkOracle =
  "0x8DE3Ac42F800a1186b6D70CB91e0D6876cC36759";
addresses.mainnet.UniswapOracle = "0xc15169Bad17e676b3BaDb699DEe327423cE6178e";

/* --- RINKEBY --- */
addresses.rinkeby = {};

addresses.rinkeby.OGN = "0xA115e16ef6e217f7a327a57031F75cE0487AaDb8";

// Compound
addresses.rinkeby.cDAI = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
addresses.rinkeby.cUSDC = "0x5b281a6dda0b271e91ae35de655ad301c976edb1";
addresses.rinkeby.cUSDT = "0x2fb298bdbef468638ad6653ff8376575ea41e768";

module.exports = addresses;
