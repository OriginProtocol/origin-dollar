import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { get } from 'lodash'
import { durationToDays } from 'utils/stake'
import { formatCurrency } from 'utils/math'
import { useWeb3React } from '@web3-react/core'

import StakeStore from 'stores/StakeStore'

const useStake = () => {
  const blockNumber = 11272254;
  const { active, account } = useWeb3React()
  const [stakeOptions, setStakeOptions] = useState([])
  const [compensationData, setCompensationData] = useState(null)
  const { durations, rates } = useStoreState(StakeStore, (s) => s)
  
  const formatBn = (amount, decimals) => {
    return ethers.utils.formatUnits(amount, decimals)
  }

  const fetchCompensationInfo = async (wallet) => {
    const result = await fetch(
      `${location.origin}/api/compensation?wallet=${wallet}`
    )
    if (result.ok) {
      const jsonResult = await result.json()
      setCompensationData(jsonResult)
    } else {
      // TODO: handle error or no complensation available
      setCompensationData(null)
    }
  }

  useEffect(() => {
    if (rates && durations && rates.length > 0 && durations.length > 0) {
      setStakeOptions([
        {
          rate: formatCurrency(formatBn(rates[0], 18), 2),
          duration: formatBn(durations[0], 0),
          durationBn: durations[0],
          durationInDays: durationToDays(formatBn(durations[0], 0) * 1000),
        },
        {
          rate: formatCurrency(formatBn(rates[1], 18), 2),
          duration: formatBn(durations[1], 0),
          durationBn: durations[1],
          durationInDays: durationToDays(formatBn(durations[1], 0) * 1000),
        },
        {
          rate: formatCurrency(formatBn(rates[2], 18), 2),
          duration: formatBn(durations[2], 0),
          durationBn: durations[2],
          durationInDays: durationToDays(formatBn(durations[2], 0) * 1000),
        },
      ])
    }
  }, [durations, rates])


  useEffect(() => {
    if (active && account) {
      fetchCompensationInfo(account)
    }
  }, [active, account])

  return {
    blockNumber,
    stakeOptions,
    compensationData,
    ognCompensationAmount: get(compensationData, 'account.ogn_compensation_human', 0),
    ousdCompensationAmount: get(compensationData, 'account.ousd_compensation_human', '0.00'),
    ousdBlockBalance: get(compensationData, 'account.eligible_ousd_value_human', '0.00'),
    fetchCompensationInfo
  }
}

export default useStake
