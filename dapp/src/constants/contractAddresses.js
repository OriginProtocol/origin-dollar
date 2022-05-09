/* IMPORTANT these are duplicated from `dapp/src/constants/contractAddresses` changes there should
 * also be done here.
 */

const addresses = {}

// Utility addresses
addresses.zero = '0x0000000000000000000000000000000000000000'
addresses.dead = '0x0000000000000000000000000000000000000001'

addresses.mainnet = {}
addresses.mainnet.Binance = '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE'
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
addresses.mainnet.BinanceAll =
  '0x564286362092d8e7936f0549571a803b203aaced,0xbe0eb53f46cd790cd13851d5eff43d12404d33e8,0xf977814e90da44bfa03b6295a0616a897441acec,0x28c6c06298d514db089934071355e5743bf21d60,0xdfd5293d8e347dfe59e90efd55b2956a1343963d,0x56eddb7aa87536c09ccc2793473599fd21a8b17f,0x21a31ee1afc51d94c2efccaa2092ad1028285549,0x9696f59e4d72e237be84ffd425dcad154bf96976,0x001866ae5b3de6caa5a51543fd9fb64f524f5478,0xab83d182f3485cf1d6ccdd34c7cfef95b4c08da4,0x8b99f3660622e21f2910ecca7fbe51d654a1517d,0x4d9ff50ef4da947364bb9650892b2554e7be5e2b,0xb8c77482e45f1f44de1745f52c74426c631bdd52,0x61189da79177950a7272c88c6058b96d4bcd6be2,0x0681d8db095565fe8a346fa0277bffde9c0edbbf,0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67,0x85b931a32a0725be14285b66f1a22178c672d69b,0x8f22f2063d253846b53609231ed80fa571bc0c8f,0xe0f0cfde7ee664943906f17f7f14342e76a5cec7,0x708396f17127c42383e3b9014072679b2f60b82f,0xd551234ae421e3bcba99a0da6d736074f22192ff,0xfe9e8709d3215310075d67e3ed32a380ccf451c8,0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be'

// Native stablecoins
addresses.mainnet.DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'
addresses.mainnet.USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
addresses.mainnet.USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
addresses.mainnet.TUSD = '0x0000000000085d4780B73119b644AE5ecd22b376'
// AAVE
addresses.mainnet.Aave = '0x24a42fD28C976A61Df5D00D0599C34c4f90748c8'
addresses.mainnet.aTUSD = '0x4DA9b813057D04BAef4e5800E36083717b4a0341'
addresses.mainnet.aUSDT = '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8'
// Compound
addresses.mainnet.COMP = '0xc00e94Cb662C3520282E6f5717214004A7f26888'
addresses.mainnet.cDAI = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'
addresses.mainnet.cUSDC = '0x39aa39c021dfbae8fac545936693ac917d5e7563'
addresses.mainnet.cUSDT = '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9'

// Ogn
addresses.mainnet.OGN = '0x8207c1ffc5b6804f6024322ccf34f29c3541ae26'

// Open Oracle
addresses.mainnet.openOracle = '0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae'

// SushiSwap
addresses.mainnet.sushiSwapRouter = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'

// Uniswap v2
addresses.mainnet.uniswapV2Router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
addresses.mainnet.uniswapDAI_ETH = '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11'
addresses.mainnet.uniswapUSDC_ETH = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'
addresses.mainnet.uniswapUSDT_ETH = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'

// Uniswap V3
addresses.mainnet.uniswapV3Router = '0xe592427a0aece92de3edee1f18e0157c05861564'
addresses.mainnet.uniswapV3Quoter = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
addresses.mainnet.uniswapV3OUSD_USDT =
  '0x129360c964e2e13910d603043f6287e5e9383374'
addresses.mainnet.uniswapV3DAI_USDT =
  '0x6f48eca74b38d2936b02ab603ff4e36a6c0e3a77'
addresses.mainnet.uniswapV3USDC_USDT =
  '0x7858e59e0c01ea06df3af3d20ac7b0003275d4bf'

addresses.mainnet.Flipper = '0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70'

// Chainlink feeds
addresses.mainnet.chainlinkETH_USD =
  '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
addresses.mainnet.chainlinkDAI_ETH =
  '0x773616E4d11A78F511299002da57A0a94577F1f4'
addresses.mainnet.chainlinkUSDC_ETH =
  '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
addresses.mainnet.chainlinkUSDT_ETH =
  '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46'
addresses.mainnet.chainlinkFAST_GAS =
  '0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C'

// WETH Token
addresses.mainnet.WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

// Deployed OUSD contracts
addresses.mainnet.VaultProxy = '0x277e80f3E14E7fB3fc40A9d6184088e0241034bD'
addresses.mainnet.Vault = '0xe75d77b1865ae93c7eaa3040b038d7aa7bc02f70'
addresses.mainnet.OUSDProxy = '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'
addresses.mainnet.WOUSDProxy = '0xD2af830E8CBdFed6CC11Bab697bB25496ed6FA62'
addresses.mainnet.CompoundStrategyProxy =
  '0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3'
addresses.mainnet.CompoundStrategy =
  '0xFaf23Bd848126521064184282e8AD344490BA6f0'
addresses.mainnet.CurveUSDCStrategyProxy =
  '0x67023c56548BA15aD3542E65493311F19aDFdd6d'
addresses.mainnet.CurveUSDCStrategy =
  '0x96E89b021E4D72b680BB0400fF504eB5f4A24327'
addresses.mainnet.CurveUSDTStrategyProxy =
  '0xe40e09cD6725E542001FcB900d9dfeA447B529C0'
addresses.mainnet.CurveUSDTStrategy =
  '0x75Bc09f72db1663Ed35925B89De2b5212b9b6Cb3'
addresses.mainnet.CurveAddressProvider =
  '0x0000000022d53366457f9d5e68ec105046fc4383'
addresses.mainnet.CurveOUSDMetaPool =
  '0x87650D7bbfC3A9F10587d7778206671719d9910D'
addresses.mainnet.CurveGaugeController =
  '0x2f50d538606fa9edd2b11e2446beb18c9d5846bb'
addresses.mainnet.CurveOUSDFactoryGauge =
  '0x25f0cE4E2F8dbA112D9b115710AC297F816087CD'

addresses.mainnet.MixOracle = '0x4d4f5e7a1FE57F5cEB38BfcE8653EFFa5e584458'
addresses.mainnet.ChainlinkOracle = '0x8DE3Ac42F800a1186b6D70CB91e0D6876cC36759'
addresses.mainnet.UniswapOracle = '0xc15169Bad17e676b3BaDb699DEe327423cE6178e'
addresses.mainnet.CompensationClaims =
  '0x9C94df9d594BA1eb94430C006c269C314B1A8281'

/* --- RINKEBY --- */
addresses.rinkeby = {}
// Compound
addresses.rinkeby.cDAI = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
addresses.rinkeby.cUSDC = '0x5b281a6dda0b271e91ae35de655ad301c976edb1'
addresses.rinkeby.cUSDT = '0x2fb298bdbef468638ad6653ff8376575ea41e768'

module.exports = addresses
