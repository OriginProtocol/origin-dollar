import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { durationToDays } from 'utils/stake'

import StakeStore from 'stores/StakeStore'

const useStake = () => {
  const [stakeOptions, setStakeOptions] = useState([])
  const { durations, rates } = useStoreState(StakeStore, (s) => s)

  const formatBn = (amount, decimals) => {
    return ethers.utils.formatUnits(amount, decimals)
  }

  useEffect(() => {
    if (rates && durations && rates.length > 0 && durations.length > 0) {
      setStakeOptions([
        {
          rate: formatBn(rates[0], 18),
          duration: formatBn(durations[0], 0),
          durationBn: durations[0],
          durationInDays: durationToDays(formatBn(durations[0], 0) * 1000),
        },
        {
          rate: formatBn(rates[1], 18),
          duration: formatBn(durations[1], 0),
          durationBn: durations[1],
          durationInDays: durationToDays(formatBn(durations[1], 0) * 1000),
        },
        {
          rate: formatBn(rates[2], 18),
          duration: formatBn(durations[2], 0),
          durationBn: durations[2],
          durationInDays: durationToDays(formatBn(durations[2], 0) * 1000),
        },
      ])
    }
  }, [durations, rates])

  return {
    stakeOptions,
  }
}

export default useStake
