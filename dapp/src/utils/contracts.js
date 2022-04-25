import { ethers, Contract, BigNumber } from 'ethers'

import ContractStore from 'stores/ContractStore'
import PoolStore from 'stores/PoolStore'
import CoinStore from 'stores/CoinStore'
import { pools } from 'constants/Pool'
import { apyDayOptions } from 'utils/constants'
import { displayCurrency } from 'utils/math'
import { sleep } from 'utils/utils'

import AccountStore from 'stores/AccountStore'
import YieldStore from 'stores/YieldStore'
import StakeStore from 'stores/StakeStore'
import addresses from 'constants/contractAddresses'
import usdtAbi from 'constants/mainnetAbi/usdt.json'
import usdcAbi from 'constants/mainnetAbi/cUsdc.json'
import daiAbi from 'constants/mainnetAbi/dai.json'
import ognAbi from 'constants/mainnetAbi/ogn.json'
import flipperAbi from 'constants/mainnetAbi/flipper.json'
import useWousdQuery from '../queries/useWousdQuery'

const curveFactoryMiniAbi = [
  {
    stateMutability: 'view',
    type: 'function',
    name: 'get_underlying_coins',
    inputs: [
      {
        name: '_pool',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address[8]',
      },
    ],
  },
]

const curveMetapoolMiniAbi = [
  {
    name: 'exchange_underlying',
    outputs: [
      {
        type: 'uint256',
        name: '',
      },
    ],
    inputs: [
      {
        type: 'int128',
        name: 'i',
      },
      {
        type: 'int128',
        name: 'j',
      },
      {
        type: 'uint256',
        name: 'dx',
      },
      {
        type: 'uint256',
        name: 'min_dy',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

/* fetchId - used to prevent race conditions.
 * Sometimes "setupContracts" is called twice with very little time in between and it can happen
 * that the call issued first (for example with not yet signed in account) finishes after the second
 * call. We must make sure that previous calls to setupContracts don't override later calls Stores
 */
export async function setupContracts(account, library, chainId, fetchId) {
  /* Using StaticJsonRpcProvider instead of JsonRpcProvider so it doesn't constantly query
   * the network for the current chainId. In case chainId changes, we rerun setupContracts
   * anyway. And StaticJsonRpcProvider also prevents "detected network changed" errors when
   * running node in forked mode.
   */
  const jsonRpcProvider = new ethers.providers.StaticJsonRpcProvider(
    process.env.ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
  )

  let provider = jsonRpcProvider

  let walletConnected = account && library

  const getContract = (address, abi, overrideProvider) => {
    try {
      return new ethers.Contract(
        address,
        abi,
        overrideProvider ? overrideProvider : provider
      )
    } catch (e) {
      console.error(
        `Error creating contract in [getContract] with address:${address} abi:${JSON.stringify(
          abi
        )}`
      )
      throw e
    }
  }

  let network
  try {
    network = require(`../../${chainId === 1 ? 'prod.' : ''}network.json`)
  } catch (e) {
    console.error('network.json file not present')
    // contract addresses not present no need to continue initialisation
    return
  }

  const contracts = {}
  for (const key in network.contracts) {
    // Use Proxy address if one exists
    const address = network.contracts[`${key}Proxy`]
      ? network.contracts[`${key}Proxy`].address
      : network.contracts[key].address

    try {
      contracts[key] = new ethers.Contract(
        address,
        network.contracts[key].abi,
        null
      )
    } catch (e) {
      console.error(
        `Error creating contract in [setup] with address:${address} name:${key}`
      )
      throw e
    }
  }

  const ousdProxy = contracts['OUSDProxy']
  const vaultProxy = contracts['VaultProxy']
  const OGNStakingProxy = contracts['OGNStakingProxy']
  let liquidityRewardOUSD_USDTProxy,
    liquidityRewardOUSD_DAIProxy,
    liquidityRewardOUSD_USDCProxy

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    liquidityRewardOUSD_USDTProxy = contracts['LiquidityRewardOUSD_USDTProxy']
    liquidityRewardOUSD_DAIProxy = contracts['LiquidityRewardOUSD_DAIProxy']
    liquidityRewardOUSD_USDCProxy = contracts['LiquidityRewardOUSD_USDCProxy']
  }

  let usdt,
    dai,
    tusd,
    usdc,
    ousd,
    vault,
    ogn,
    wousd,
    flipper,
    uniV2OusdUsdt,
    uniV2OusdUsdt_iErc20,
    uniV2OusdUsdt_iUniPair,
    uniV2OusdUsdc,
    uniV2OusdUsdc_iErc20,
    uniV2OusdUsdc_iUniPair,
    uniV2OusdDai,
    uniV2OusdDai_iErc20,
    uniV2OusdDai_iUniPair,
    uniV3OusdUsdt,
    uniV3DaiUsdt,
    uniV3UsdcUsdt,
    uniV3NonfungiblePositionManager,
    uniV3SwapRouter,
    uniV2Router,
    sushiRouter,
    uniV3SwapQuoter,
    liquidityOusdUsdt,
    liquidityOusdUsdc,
    liquidityOusdDai,
    ognStaking,
    ognStakingView,
    compensation,
    chainlinkEthAggregator,
    chainlinkFastGasAggregator,
    curveAddressProvider

  let iVaultJson,
    wousdJSON,
    liquidityRewardJson,
    iErc20Json,
    iUniPairJson,
    uniV3PoolJson,
    uniV3FactoryJson,
    uniV3NonfungiblePositionManagerJson,
    uniV3SwapRouterJson,
    uniV2SwapRouterJson,
    uniV3SwapQuoterJson,
    singleAssetStakingJson,
    compensationClaimsJson,
    chainlinkAggregatorV3Json,
    curveAddressProviderJson

  try {
    iVaultJson = require('../../abis/IVault.json')
    liquidityRewardJson = require('../../abis/LiquidityReward.json')
    iErc20Json = require('../../abis/IERC20.json')
    iUniPairJson = require('../../abis/IUniswapV2Pair.json')
    singleAssetStakingJson = require('../../abis/SingleAssetStaking.json')
    compensationClaimsJson = require('../../abis/CompensationClaims.json')
    uniV3PoolJson = require('../../abis/UniswapV3Pool.json')
    uniV3FactoryJson = require('../../abis/UniswapV3Factory.json')
    uniV3NonfungiblePositionManagerJson = require('../../abis/UniswapV3NonfungiblePositionManager.json')
    uniV3SwapRouterJson = require('../../abis/UniswapV3SwapRouter.json')
    uniV2SwapRouterJson = require('../../abis/UniswapV2Router.json')
    uniV3SwapQuoterJson = require('../../abis/UniswapV3Quoter.json')
    chainlinkAggregatorV3Json = require('../../abis/ChainlinkAggregatorV3Interface.json')
    curveAddressProviderJson = require('../../abis/CurveAddressProvider.json')
    wousdJSON = require('../../abis/WOUSD.json')
  } catch (e) {
    console.error(`Can not find contract artifact file: `, e)
  }

  vault = getContract(vaultProxy.address, iVaultJson.abi)

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    liquidityOusdUsdt = getContract(
      liquidityRewardOUSD_USDTProxy.address,
      liquidityRewardJson.abi
    )
    liquidityOusdUsdc = getContract(
      liquidityRewardOUSD_USDCProxy.address,
      liquidityRewardJson.abi
    )
    liquidityOusdDai = getContract(
      liquidityRewardOUSD_DAIProxy.address,
      liquidityRewardJson.abi
    )
  }

  ognStaking = getContract(OGNStakingProxy.address, singleAssetStakingJson.abi)
  ognStakingView = getContract(
    OGNStakingProxy.address,
    singleAssetStakingJson.abi,
    jsonRpcProvider
  )

  ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
  usdt = getContract(addresses.mainnet.USDT, usdtAbi.abi)
  usdc = getContract(addresses.mainnet.USDC, usdcAbi.abi)
  dai = getContract(addresses.mainnet.DAI, daiAbi.abi)
  ogn = getContract(addresses.mainnet.OGN, ognAbi)
  wousd = getContract(addresses.mainnet.WOUSDProxy, wousdJSON.abi)
  flipper = getContract(addresses.mainnet.Flipper, flipperAbi)

  uniV3OusdUsdt = getContract(
    addresses.mainnet.uniswapV3OUSD_USDT,
    uniV3PoolJson.abi
  )
  uniV3SwapRouter = getContract(
    addresses.mainnet.uniswapV3Router,
    uniV3SwapRouterJson.abi
  )
  uniV3SwapQuoter = getContract(
    addresses.mainnet.uniswapV3Quoter,
    uniV3SwapQuoterJson.abi
  )
  uniV2Router = getContract(
    addresses.mainnet.uniswapV2Router,
    uniV2SwapRouterJson.abi
  )
  sushiRouter = getContract(
    addresses.mainnet.sushiSwapRouter,
    uniV2SwapRouterJson.abi
  )
  chainlinkEthAggregator = getContract(
    addresses.mainnet.chainlinkETH_USD,
    chainlinkAggregatorV3Json.abi
  )

  chainlinkFastGasAggregator = getContract(
    addresses.mainnet.chainlinkFAST_GAS,
    chainlinkAggregatorV3Json.abi
  )

  curveAddressProvider = getContract(
    addresses.mainnet.CurveAddressProvider,
    curveAddressProviderJson.abi
  )

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    uniV2OusdUsdt = null
    uniV2OusdUsdc = null
    uniV2OusdDai = null
    throw new Error(
      'uniV2OusdUsdt, uniV2OusdUsdc, uniV2OusdDai mainnet address is missing'
    )
  }

  compensation = getContract(
    addresses.mainnet.CompensationClaims,
    compensationClaimsJson.abi
  )

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    uniV2OusdUsdt_iErc20 = getContract(uniV2OusdUsdt.address, iErc20Json.abi)
    uniV2OusdUsdt_iUniPair = getContract(
      uniV2OusdUsdt.address,
      iUniPairJson.abi
    )

    uniV2OusdUsdc_iErc20 = getContract(uniV2OusdUsdc.address, iErc20Json.abi)
    uniV2OusdUsdc_iUniPair = getContract(
      uniV2OusdUsdc.address,
      iUniPairJson.abi
    )

    uniV2OusdDai_iErc20 = getContract(uniV2OusdDai.address, iErc20Json.abi)
    uniV2OusdDai_iUniPair = getContract(uniV2OusdDai.address, iUniPairJson.abi)
  }

  const fetchExchangeRates = async () => {
    const coins = {
      dai: dai,
      usdt: usdt,
      usdc: usdc,
    }
    const ousdExchangeRates = {
      ...ContractStore.currentState.ousdExchangeRates,
    }
    const userActive = AccountStore.currentState.active === 'active'
    // do not fetch anything if the user is not active
    if (!userActive) {
      return
    }

    for (const name in coins) {
      const coin = coins[name]
      try {
        const priceBNMint = await vault.priceUSDMint(coin.address)
        const priceBNRedeem = await vault.priceUSDRedeem(coin.address)
        // Oracle returns with 18 decimal places
        // Also, convert that to USD/<coin> format
        const priceMint = Number(priceBNMint.toString()) / 1000000000000000000
        const priceRedeem =
          Number(priceBNRedeem.toString()) / 1000000000000000000
        ousdExchangeRates[name] = {
          mint: priceMint,
          redeem: priceRedeem,
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate', name, err)
      }
    }

    ContractStore.update((store) => {
      store.ousdExchangeRates = { ...ousdExchangeRates }
    })
  }

  const fetchOgnStats = async () => {
    try {
      const response = await fetch(
        `${process.env.COINGECKO_API}/coins/origin-protocol`
      )
      if (response.ok) {
        const json = await response.json()
        const price = json.market_data.current_price.usd
        const circulating_supply = json.market_data.circulating_supply
        const market_cap = json.market_data.market_cap.usd

        CoinStore.update((s) => {
          s.ogn = {
            price,
            circulating_supply,
            market_cap,
          }
        })
      }
    } catch (err) {
      console.error('Failed to fetch OGN token statistics', err)
    }
  }

  const fetchCreditsPerToken = async () => {
    try {
      const response = await fetch(process.env.CREDITS_ANALYTICS_ENDPOINT)
      if (response.ok) {
        const json = await response.json()
        YieldStore.update((s) => {
          s.currentCreditsPerToken = parseFloat(json.current_credits_per_token)
          s.nextCreditsPerToken = parseFloat(json.next_credits_per_token)
        })
      }
    } catch (err) {
      console.error('Failed to fetch credits per token', err)
    }
  }

  const fetchCreditsBalance = async () => {
    try {
      if (!walletConnected) {
        return
      }
      const credits = await ousd.creditsBalanceOf(account)
      const wousdValue = await wousd.maxWithdraw(account)
      const creditsWrapped = wousdValue.mul(credits[1])
      AccountStore.update((s) => {
        s.creditsBalanceOf = ethers.utils.formatUnits(credits[0], 18)
        s.creditsWrapped = ethers.utils.formatUnits(creditsWrapped, 36)
      })
    } catch (err) {
      console.error('Failed to fetch credits balance', err)
    }
  }

  const callWithDelay = () => {
    setTimeout(async () => {
      Promise.all([
        fetchExchangeRates(),
        fetchCreditsPerToken(),
        fetchCreditsBalance(),
        fetchOgnStats(),
      ])
    }, 2)
  }

  callWithDelay()

  const [curveRegistryExchange, curveOUSDMetaPool, curveUnderlyingCoins] =
    await setupCurve(curveAddressProvider, getContract, chainId)

  if (ContractStore.currentState.fetchId > fetchId) {
    console.log('Contracts already setup with newer fetchId. Exiting...')
    return
  }

  if (window.fetchInterval) {
    clearInterval(fetchInterval)
  }

  if (walletConnected) {
    // execute in parallel and repeat in an interval
    window.fetchInterval = setInterval(() => {
      callWithDelay()
    }, 20000)
  }

  const contractsToExport = {
    usdt,
    dai,
    tusd,
    usdc,
    ousd,
    vault,
    ogn,
    wousd,
    uniV2OusdUsdt,
    uniV2OusdUsdt_iErc20,
    uniV2OusdUsdt_iUniPair,
    uniV2OusdUsdc,
    uniV2OusdUsdc_iErc20,
    uniV2OusdUsdc_iUniPair,
    uniV2OusdDai,
    uniV2OusdDai_iErc20,
    uniV2OusdDai_iUniPair,
    uniV3OusdUsdt,
    uniV3DaiUsdt,
    uniV3UsdcUsdt,
    uniV3SwapRouter,
    uniV3SwapQuoter,
    uniV2Router,
    sushiRouter,
    uniV3NonfungiblePositionManager,
    liquidityOusdUsdt,
    liquidityOusdUsdc,
    liquidityOusdDai,
    ognStaking,
    ognStakingView,
    compensation,
    flipper,
    chainlinkEthAggregator,
    chainlinkFastGasAggregator,
    curveAddressProvider,
    curveRegistryExchange,
    curveOUSDMetaPool,
  }

  const coinInfoList = {
    usdt: {
      contract: usdt,
      decimals: 6,
    },
    usdc: {
      contract: usdc,
      decimals: 6,
    },
    dai: {
      contract: dai,
      decimals: 18,
    },
    ousd: {
      contract: ousd,
      decimals: 18,
    },
  }

  ContractStore.update((s) => {
    s.contracts = contractsToExport
    s.coinInfoList = coinInfoList
    s.walletConnected = walletConnected
    s.chainId = chainId
    s.readOnlyProvider = jsonRpcProvider
    s.curveMetapoolUnderlyingCoins = curveUnderlyingCoins
    s.fetchId = fetchId
  })

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    await setupPools(contractsToExport)
  }

  await setupStakes(contractsToExport)
  await afterSetup(contractsToExport)

  return contractsToExport
}

// calls to be executed only once after setup
const setupCurve = async (curveAddressProvider, getContract, chainId) => {
  const registryExchangeAddress = await curveAddressProvider.get_address(2)
  const registryExchangeJson = require('../../abis/CurveRegistryExchange.json')

  const factoryAddress = await curveAddressProvider.get_address(3)
  const factory = getContract(factoryAddress, curveFactoryMiniAbi)
  const curveUnderlyingCoins = (
    await factory.get_underlying_coins(addresses.mainnet.CurveOUSDMetaPool)
  ).map((address) => address.toLowerCase())

  const curveOUSDMetaPool = getContract(
    addresses.mainnet.CurveOUSDMetaPool,
    curveMetapoolMiniAbi
  )

  return [
    getContract(registryExchangeAddress, registryExchangeJson.abi),
    curveOUSDMetaPool,
    curveUnderlyingCoins,
  ]

  return []
}

// calls to be executed only once after setup
const afterSetup = async ({ vault }) => {
  const redeemFee = await vault.redeemFeeBps()
  YieldStore.update((s) => {
    s.redeemFee = parseFloat(ethers.utils.formatUnits(redeemFee, 4))
  })
}

const setupStakes = async (contractsToExport) => {
  try {
    const [durations, rates] = await Promise.all([
      await contractsToExport.ognStakingView.getAllDurations(),
      await contractsToExport.ognStakingView.getAllRates(),
    ])

    const adjustedRates = durations.map((duration, index) => {
      const days = duration / (24 * 60 * 60)

      if (
        process.env.NODE_ENV !== 'production' &&
        Math.floor(days) !== Math.ceil(days)
      ) {
        const largeInt = 100000000
        // On dev, one has a shorter duration
        return rates[index]
          .mul(BigNumber.from(365 * largeInt))
          .div(BigNumber.from(Math.round(days * largeInt)))
      } else {
        return rates[index].mul(BigNumber.from(365)).div(BigNumber.from(days))
      }
    })

    StakeStore.update((s) => {
      s.durations = durations
      s.rates = adjustedRates
    })
  } catch (e) {
    console.error('Can not read initial public stake data: ', e)
  }
}

const setupPools = async (contractsToExport) => {
  try {
    const enrichedPools = await Promise.all(
      pools.map(async (pool) => {
        let coin1Address, coin2Address, poolLpTokenBalance
        const poolContract = contractsToExport[pool.pool_contract_variable_name]
        const lpContract = contractsToExport[pool.lp_contract_variable_name]
        const lpContract_uniPair =
          contractsToExport[pool.lp_contract_variable_name_uniswapPair]
        const lpContract_ierc20 =
          contractsToExport[pool.lp_contract_variable_name_ierc20]

        if (pool.lp_contract_type === 'uniswap-v2') {
          ;[coin1Address, coin2Address, poolLpTokenBalance] = await Promise.all(
            [
              await lpContract_uniPair.token0(),
              await lpContract_uniPair.token1(),
              await lpContract_ierc20.balanceOf(poolContract.address),
            ]
          )
        }

        return {
          ...pool,
          coin_one: {
            ...pool.coin_one,
            contract_address: coin1Address,
          },
          coin_two: {
            ...pool.coin_two,
            contract_address: coin2Address,
          },
          pool_deposits: await displayCurrency(
            poolLpTokenBalance,
            lpContract_ierc20
          ),
          pool_contract_address: poolContract.address,
          contract: poolContract,
          lpContract: lpContract,
        }
      })
    )

    PoolStore.update((s) => {
      s.pools = enrichedPools
    })
  } catch (e) {
    console.error('Error thrown in setting up pools: ', e)
  }
}
