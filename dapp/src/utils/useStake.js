import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { durationToDays } from 'utils/stake'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { useWeb3React } from '@web3-react/core'

import StakeStore from 'stores/StakeStore'

const useStake = () => {
  const blockNumber = 11272254;
  const { active, account } = useWeb3React()
  const [stakeOptions, setStakeOptions] = useState([])
  const [compensationData, setCompensationData] = useState(null)
  const [ognCompensationAmount, setOGNCompensationAmount] = useState(0)
  const [ousdCompensationAmount, setOUSDCompensationAmount] = useState(0)
  const [ousdBlockBalance, setOUSDBlockBalance] = useState(0)
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
      setOGNCompensationAmount(jsonResult.account.ogn_compensation_human)
      setOUSDCompensationAmount(jsonResult.account.ousd_compensation_human)
      setOUSDBlockBalance(jsonResult.account.eligible_ousd_value_human)
    } else {
      // TODO: handle error or no complensation available
      setCompensationData(null)
      setOGNCompensationAmount(0) 
      setOUSDCompensationAmount("0.00")
      setOUSDBlockBalance("0.00")
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
    ognCompensationAmount,
    ousdCompensationAmount,
    ousdBlockBalance,
    fetchCompensationInfo
  }
}

export default useStake
