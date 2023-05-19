import React from 'react'
import { get } from 'lodash'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'

const useEthPrice = () => {
  const [ethPrice, setEthPrice] = React.useState(0)
  const contracts = useStoreState(ContractStore, (s) => s.contracts)
  const chainId = useStoreState(ContractStore, (s) => s.chainId)

  const _fetchEthPriceCryptoApi = async () => {
    try {
      const ethPriceRequest = await fetch(
        'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD'
      )
      // floor so we can convert to BN without a problem
      setEthPrice(Math.floor(get(await ethPriceRequest.json(), 'USD')))
    } catch (e) {
      console.error(`Can not fetch eth prices: ${e?.message}`)
      setEthPrice(0)
    }
  }

  const _fetchEthPriceChainlink = async () => {
    try {
      const priceFeed = await contracts.chainlinkEthAggregator.latestRoundData()
      setEthPrice(
        Math.floor(parseFloat(ethers.utils.formatUnits(priceFeed.answer, 8)))
      )
    } catch (e) {
      console.error('Error happened fetching eth usd chainlink data:', e)
      setEthPrice(0)
    }
  }

  React.useEffect(() => {
    ;(async function () {
      if (!ethPrice) {
        if (chainId === 1 && contracts.chainlinkEthAggregator) {
          return await _fetchEthPriceChainlink()
        } else {
          // Fallback
          return await _fetchEthPriceCryptoApi()
        }
      }
    })()
  }, [contracts.chainlinkEthAggregator])

  return ethPrice
}

export default useEthPrice
