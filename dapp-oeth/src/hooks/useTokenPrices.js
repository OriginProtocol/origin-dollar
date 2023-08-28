import { useEffect, useState } from 'react'

const tokenConfiguration = {
  ethereum: {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
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
      'binance-smart-chain': '0x64048a7eecf3a2f1ba9e144aac3d7db6e58f555e',
      'polygon-pos': '0xee327f889d5947c1dc1934bb208a1e792f953e96',
      'arbitrum-one': '0x178412e79c25968a32e89b11f63b33f733770c2a',
      'optimistic-ethereum': '0x6806411765af15bddd26f8f544a34cc40cb9838b',
      'polygon-zkevm': '0xcf7ecee185f19e2e970a301ee37f93536ed66179',
      moonbeam: '0x82bbd1b6f6de2b7bb63d3e1546e6b1553508be99',
      fantom: '0x9e73f99ee061c8807f69f9c6ccc44ea3d8c373ee',
    },
  },
  sfrxeth: {
    id: 'staked-frax-ether',
    symbol: 'sfrxeth',
    name: 'Staked Frax Ether',
    platforms: {
      ethereum: '0xac3e018457b222d93114458476f3e3416abbe38f',
      'binance-smart-chain': '0x3cd55356433c89e50dc51ab07ee0fa0a95623d53',
      'polygon-pos': '0x6d1fdbb266fcc09a16a22016369210a15bb95761',
      'arbitrum-one': '0x95ab45875cffdba1e5f451b950bc2e42c0053f39',
      'optimistic-ethereum': '0x484c2d6e3cdd945a8b2df735e079178c1036578c',
      moonbeam: '0xecf91116348af1cffe335e9807f0051332be128d',
      fantom: '0xb90ccd563918ff900928dc529aa01046795ccb4a',
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
      'polygon-pos': '0x0266f4f08d82372cf0fcbccc0ff74309089c74d1',
      'arbitrum-one': '0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8',
      'optimistic-ethereum': '0x9bcef72be871e61ed4fbbc7630889bee758eb81d',
    },
  },
}

const useTokenPrice = () => {
  const [error, setError] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [prices, setPrices] = useState(null)

  const fetchTokenPricesFromCoinGecko = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const currencies = Object.keys(tokenConfiguration)

      const tokenIds = currencies.map((token) => tokenConfiguration[token].id)

      const prices = await fetch(
        `${
          process.env.NEXT_PUBLIC_COINGECKO_API
        }/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd`
      )
        .then((res) => res.json())
        // Map coin gecko token ids to our token registered setup
        .then((data) =>
          currencies.reduce((acc, token) => {
            const { id, symbol } = tokenConfiguration[token]
            acc[symbol] = data[id]
            return acc
          }, {})
        )

      setPrices(prices)
    } catch (e) {
      setError(e.message)
      console.log(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTokenPricesFromCoinGecko()
  }, [])

  return [
    { data: prices, isLoading, error },
    { onRefresh: fetchTokenPricesFromCoinGecko },
  ]
}

export default useTokenPrice
