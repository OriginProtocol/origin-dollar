import { ethers, Contract, BigNumber } from 'ethers'
import addresses from '../constants/contractAddresses'
import usdtAbi from '../constants/mainnetAbi/usdt.json'
import usdcAbi from '../constants/mainnetAbi/cUsdc.json'
import daiAbi from '../constants/mainnetAbi/dai.json'
import ognAbi from '../constants/mainnetAbi/ogn.json'
import ContractStore from '../stores/ContractStore'
import CoinStore from '../stores/CoinStore'
import AccountStore from '../stores/AccountStore'


const NetworkChainMapping = { MAINNET:1, RINKEBY:4 }

const setupContracts = async ({account, network, provider}) => {
  const chainId = parseInt(network.chainId)
  const getContract = (address, abi) => {
    return new ethers.Contract(address, abi, provider);
  }
  
  const contracts = {}
  for (const key in network.contracts) {
    // Use Proxy address if one exists
    const address = network.contracts[`${key}Proxy`]
      ? network.contracts[`${key}Proxy`].address
      : network.contracts[key].address

    contracts[key] = new ethers.Contract(
      address,
      network.contracts[key].abi,
      provider
    )
  }

  console.log("chainId:", chainId);
  console.log("Provider:", provider);
  console.log("Contracts are:", Object.keys(contracts));

  const ousdProxy = contracts['OUSDProxy']
  const vaultProxy = contracts['VaultProxy']
  const OGNStakingProxy = contracts['OGNStakingProxy']

  let usdt,
    dai,
    tusd,
    usdc,
    ousd,
    vault,
    ogn,
    ognStaking,
    ognStakingView

  let iVaultJson,
    iErc20Json,
    iUniPairJson,
    singleAssetStakingJson

  try {
    iVaultJson = require('../abis/IVault.json')
    iErc20Json = require('../abis/IERC20.json')
    iUniPairJson = require('../abis/IUniswapV2Pair.json')
    singleAssetStakingJson = require('../abis/SingleAssetStaking.json')
  } catch (e) {
    console.error(`Can not find contract artifact file: `, e)
  }

  vault = getContract(vaultProxy.address, iVaultJson.abi)

  ognStaking = getContract(OGNStakingProxy.address, singleAssetStakingJson.abi)
  ognStakingView = getContract(
    OGNStakingProxy.address,
    singleAssetStakingJson.abi
  )

  ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
  if (chainId == 31337 || chainId == 4) {
    usdt = contracts['MockUSDT']
    usdc = contracts['MockUSDC']
    dai = contracts['MockDAI']
    ogn = contracts['MockOGN']
  } else {
    usdt = getContract(addresses.mainnet.USDT, usdtAbi.abi)
    usdc = getContract(addresses.mainnet.USDC, usdcAbi.abi)
    dai = getContract(addresses.mainnet.DAI, daiAbi.abi)
    ogn = getContract(addresses.mainnet.OGN, ognAbi)

  }

  const fetchExchangeRates = async () => {
    const coins = ['dai', 'usdt', 'usdc']
    const ousdExchangeRates = {
      ...ContractStore.currentState.ousdExchangeRates,
    }
    const userActive = AccountStore.currentState.active === 'active'
    // do not fetch anything if the user is not active
    if (!userActive) {
      return
    }

    for (const coin of coins) {
      try {
        const priceBNMint = await vault.priceUSDMint(coin.toUpperCase())
        const priceBNRedeem = await vault.priceUSDRedeem(coin.toUpperCase())
        // Oracle returns with 18 decimal places
        // Also, convert that to USD/<coin> format
        const priceMint = Number(priceBNMint.toString()) / 1000000000000000000
        const priceRedeem =
          Number(priceBNRedeem.toString()) / 1000000000000000000
        ousdExchangeRates[coin] = {
          mint: priceMint,
          redeem: priceRedeem,
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate', coin, err)
      }
    }

    ContractStore.update((store) => {
      store.ousdExchangeRates = { ...ousdExchangeRates }
    })
  }

  const fetchOgnStats = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_COINGECKO_API}/coins/origin-protocol`
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
      console.error('Failed to fetch APY', err)
    }
  }

  const fetchAPY = async () => {
    try {
      const response = await fetch(process.env.REACT_APP_APR_ANALYTICS_ENDPOINT)
      if (response.ok) {
        const json = await response.json()
        const apy = aprToApy(parseFloat(json.apr), 7)
        ContractStore.update((s) => {
          s.apy = apy
        })
      }
    } catch (err) {
      console.error('Failed to fetch APY', err)
    }
  }

  const fetchCreditsPerToken = async () => {
    try {
      const response = await fetch(process.env.REACT_APP_CREDITS_ANALYTICS_ENDPOINT)
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
      if (!provider) {
        return
      }
      const credits = await ousd.creditsBalanceOf(account)
      AccountStore.update((s) => {
        s.creditsBalanceOf = ethers.utils.formatUnits(credits[0], 18)
      })
    } catch (err) {
      console.error('Failed to fetch credits balance', err)
    }
  }

  const callWithDelay = () => {
    setTimeout(async () => {
      Promise.all([
        fetchExchangeRates(),
        //fetchCreditsPerToken(),
        fetchCreditsBalance(),
        //fetchAPY(),
        //fetchOgnStats(),
      ])
    }, 2)
  }

  callWithDelay()

  if (window.fetchInterval) {
    clearInterval(fetchInterval)
  }

  if (provider) {
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
    ognStaking,
    ognStakingView,
  }

  ContractStore.update((s) => {
    s.contracts = contractsToExport
  })

  if (process.env.ENABLE_LIQUIDITY_MINING === 'true') {
    await setupPools(account, contractsToExport)
  }

  return contractsToExport
}

// calls to be executed only once after setup
const afterSetup = async ({ vault }) => {
  const redeemFee = await vault.redeemFeeBps()
  YieldStore.update((s) => {
    s.redeemFee = parseFloat(ethers.utils.formatUnits(redeemFee, 4))
  })
}

export default setupContracts;
