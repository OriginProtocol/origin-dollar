/* IMPORTANT these are duplicated from `dapp/src/constants/contractAddresses` changes there should
 * also be done here.
 */

const addresses = {}

// Utility addresses
addresses.zero = '0x0000000000000000000000000000000000000000'
addresses.dead = '0x0000000000000000000000000000000000000001'

addresses.mainnet = {}
// Native stablecoins
addresses.mainnet.Binance = '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE'
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

// Open Oracle
addresses.mainnet.openOracle = '0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae'

// Uniswap pairs
addresses.mainnet.uniswapDAI_ETH = '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11'
addresses.mainnet.uniswapUSDC_ETH = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'
addresses.mainnet.uniswapUSDT_ETH = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'

// Chainlink feeds
addresses.mainnet.chainlinkETH_USD =
  '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
addresses.mainnet.chainlinkDAI_ETH =
  '0x773616E4d11A78F511299002da57A0a94577F1f4'
addresses.mainnet.chainlinkUSDC_ETH =
  '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
addresses.mainnet.chainlinkUSDT_ETH =
  '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46'

// WETH Token
addresses.mainnet.WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

/* --- RINKEBY --- */

// Compound
addresses.rinkeby.cDAI = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
addresses.rinkeby.cUSDC = '0x5b281a6dda0b271e91ae35de655ad301c976edb1'
addresses.rinkeby.cUSDT = '0x2fb298bdbef468638ad6653ff8376575ea41e768'

module.exports = addresses
