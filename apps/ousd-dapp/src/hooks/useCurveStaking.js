import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { ethers } from 'ethers'

const useCurveStake = () => {
  const [baseApy, setBaseApy] = useState(false)
  const [virtualPrice, setVirtualPrice] = useState(false)
  const [curveRate, setCurveRate] = useState(false)

  useEffect(() => {
    fetchBaseApy()
    fetchCrvRate()
  }, [])

  const fetchBaseApy = async () => {
    const response = await fetch('https://api.curve.fi/api/getFactoryAPYs')
    if (response.ok) {
      const json = await response.json()
      if (!json.success) {
        console.error(
          'Could not fetch curve factory APYs: ',
          JSON.stringify(json)
        )
        return
      }

      const pools = json.data.poolDetails.filter(
        (pool) => pool.poolSymbol === 'OUSD'
      )
      if (pools.length !== 1) {
        console.warning(
          'Unexpected number of OUSD pools detected: ',
          JSON.stringify(pools)
        )
      }

      setBaseApy(pools[0].apy)
      setVirtualPrice(ethers.utils.parseUnits(pools[0].virtualPrice, 0))
    } else {
      console.error('Could not fetch curve factory APYs')
    }
  }

  const fetchCrvRate = async () => {
    const crvAddress = '0xd533a949740bb3306d119cc777fa900ba034cd52'
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${crvAddress}&vs_currencies=usd`
    )
    if (response.ok) {
      const json = await response.json()
      setCurveRate(json[crvAddress]['usd'])
    } else {
      console.error('Could not fetch curve rate')
    }
  }

  return {
    baseApy,
    virtualPrice,
    curveRate,
  }
}

export default useCurveStake
