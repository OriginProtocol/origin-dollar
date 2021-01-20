import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'
import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'
import StakeStore from 'stores/StakeStore'
import { formatCurrency } from 'utils/math'
import { usePrevious } from 'utils/hooks'

const useCompensation = () => {
  const ousdClaimedLocalStorageKey = (account) =>
    `ousd_claimed_${account.toLowerCase()}`
  const blockNumber = 11272254
  const [compensationData, setCompensationData] = useState(null)
  const [compensationOUSDBalance, setCompensationOUSDBalance] = useState(null)
  const { active, account } = useWeb3React()
  const prevAccount = usePrevious(account)
  const { compensation: compensationContract } = useStoreState(
    ContractStore,
    (s) => {
      if (s.contracts) {
        return s.contracts
      }
      return {}
    }
  )
  const ognClaimed = useStoreState(StakeStore, (s) => s.airDropStakeClaimed)

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

  const fetchCompensationOUSDBalance = async () => {
    setCompensationOUSDBalance(
      parseFloat(
        formatCurrency(
          ethers.utils.formatUnits(
            await compensationContract.balanceOf(account),
            18
          ),
          2
        )
      )
    )
  }

  const fetchAllData = (active, account, compensationContract) => {
    if (active && account) {
      fetchCompensationInfo(account)
    }

    if (
      compensationContract &&
      compensationContract.provider &&
      active &&
      account
    ) {
      fetchCompensationOUSDBalance()
    }
  }
  const refetchData = () => {
    fetchAllData(active, account, compensationContract)
  }

  useEffect(() => {
    // account changed
    if (prevAccount && prevAccount !== account) {
      setCompensationData(null)
      setCompensationOUSDBalance(null)
    }

    fetchAllData(active, account, compensationContract)
  }, [active, account, compensationContract])

  const replaceAll = (string, search, replace) => {
    return string.split(search).join(replace)
  }

  const ousdCompensationAmount = parseFloat(
    replaceAll(
      get(compensationData, 'account.ousd_compensation_human', '0'),
      ',',
      ''
    )
  )
  return {
    compensationData,
    ognCompensationAmount: parseFloat(
      replaceAll(
        get(compensationData, 'account.ogn_compensation_human', '0'),
        ',',
        ''
      )
    ),
    ousdCompensationAmount,
    eligibleOusdBalance: parseFloat(
      replaceAll(
        get(compensationData, 'account.eligible_ousd_value_human', '0'),
        ',',
        ''
      )
    ),
    fetchCompensationInfo,
    fetchCompensationOUSDBalance,
    ousdClaimed: compensationOUSDBalance === 0 && ousdCompensationAmount > 0,
    ognClaimed,
    refetchData,
    remainingOUSDCompensation: compensationOUSDBalance,
    blockNumber,
  }
}

export default useCompensation
