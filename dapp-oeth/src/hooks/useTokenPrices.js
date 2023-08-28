import { useEffect, useState } from 'react'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { utils } from 'ethers'

const tokenConfiguration = {
  eth: {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
  },
  weth: {
    id: 'weth',
    symbol: 'weth',
    name: 'WETH',
    platforms: {
      ethereum: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    },
  },
  oeth: {
    id: 'origin-ether',
    symbol: 'oeth',
    name: 'Origin Ether',
    platforms: {
      ethereum: '0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3',
    },
  },
  frxeth: {
    id: 'frax-ether',
    symbol: 'frxeth',
    name: 'Frax Ether',
    platforms: {
      ethereum: '0x5e8422345238f34275888049021821e8e08caa1f',
    },
  },
  sfrxeth: {
    id: 'staked-frax-ether',
    symbol: 'sfrxeth',
    name: 'Staked Frax Ether',
    platforms: {
      ethereum: '0xac3e018457b222d93114458476f3e3416abbe38f',
    },
  },
  steth: {
    id: 'staked-ether',
    symbol: 'steth',
    name: 'Lido Staked Ether',
    platforms: {
      ethereum: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    },
  },
  reth: {
    id: 'rocket-pool-eth',
    symbol: 'reth',
    name: 'Rocket Pool ETH',
    platforms: {
      ethereum: '0xae78736cd615f374d3085123a210448e74fc6393',
    },
  },
}

const oethOraclePrice = async (contract, tokenAddress) => {
  try {
    return await contract.price(tokenAddress)
  } catch (e) {
    console.error(e)
    return utils.parseEther('1')
  }
}

const stakedFraxPrice = async (contract) => {
  try {
    return await contract.previewRedeem(utils.parseEther('1'))
  } catch (e) {
    console.error(e)
    return utils.parseEther('1')
  }
}

const oraclePrices = async (tokens, contracts) => {
  if (!contracts.chainlinkEthAggregator || !contracts.oethOracleRouter) {
    return {}
  }

  // Fetch baseline ETH price for conversion
  const feed = await contracts.chainlinkEthAggregator.latestRoundData()
  const ethPrice = Number(utils.formatUnits(feed?.answer, 8))

  // Fetch token ratios
  const tokenToPricingMethod = {
    frxeth: oethOraclePrice.bind(
      null,
      contracts.oethOracleRouter,
      tokenConfiguration.frxeth.platforms.ethereum
    ),
    steth: oethOraclePrice.bind(
      null,
      contracts.oethOracleRouter,
      tokenConfiguration.steth.platforms.ethereum
    ),
    reth: oethOraclePrice.bind(
      null,
      contracts.oethOracleRouter,
      tokenConfiguration.reth.platforms.ethereum
    ),
    sfrxeth: stakedFraxPrice.bind(null, contracts.sfrxeth),
  }

  // Undefined token will return ratio 1:1 with eth
  const fetchTokenRatio = async (token) =>
    (await tokenToPricingMethod?.[token]?.()) || utils.parseEther('1')

  const generateTokenMapping = (data) =>
    data.reduce(
      (acc, weiRatio, index) => ({
        ...acc,
        [tokens[index]]: Number(utils.formatEther(weiRatio)) * ethPrice,
      }),
      {}
    )

  return Promise.all(tokens.map(fetchTokenRatio)).then(generateTokenMapping)
}

const coingeckoPrices = async (tokens) => {
  const tokenIds = tokens.map((token) => tokenConfiguration[token].id)

  const baseUri = `${
    process.env.NEXT_PUBLIC_COINGECKO_API
  }/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd`

  const generateTokenMapping = (data) =>
    tokens.reduce((acc, token) => {
      const { id, symbol } = tokenConfiguration[token]
      return {
        ...acc,
        [symbol]: data[id]?.usd || 0,
      }
    }, {})

  return fetch(baseUri)
    .then((res) => res.json())
    .then(generateTokenMapping)
}

const useTokenPrices = ({ tokens = [] } = {}) => {
  const [error, setError] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [prices, setPrices] = useState(null)
  const contracts = useStoreState(ContractStore, (s) => s.contracts)
  const chainId = useStoreState(ContractStore, (s) => s.chainId)

  const queryTokens =
    tokens?.length > 0 ? tokens : Object.keys(tokenConfiguration)

  const fetchTokenPrices = async () => {
    try {
      setIsLoading(true)
      setError(null)

      let prices

      if (chainId === 1) {
        prices = await oraclePrices(queryTokens, contracts)
      } else {
        prices = await coingeckoPrices(queryTokens)
      }

      setPrices(prices)
    } catch (e) {
      setError(e.message)
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTokenPrices()
  }, [chainId, contracts])

  return [{ data: prices, isLoading, error }, { onRefresh: fetchTokenPrices }]
}

export default useTokenPrices
