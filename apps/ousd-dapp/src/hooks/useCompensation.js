import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import { sleep } from 'utils/utils'

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
    const ousdBalance = parseFloat(
      formatCurrency(
        ethers.utils.formatUnits(
          await compensationContract.balanceOf(account),
          18
        ),
        2
      )
    )
    setCompensationOUSDBalance(ousdBalance)
    return ousdBalance
  }

  const fetchAllData = async (active, account, compensationContract) => {
    let ousdBalance
    if (active && account) {
      await fetchCompensationInfo(account)
    }

    if (
      compensationContract &&
      compensationContract.provider &&
      active &&
      account
    ) {
      ousdBalance = await fetchCompensationOUSDBalance()
    }
    return ousdBalance
  }

  /* Very weird workaround for Metamask provider. Turn out that Metamask uses
   * some sort of caching when it comes to ERC20 balanceOf calls. I would issue balanceOf
   * calls on local node running in fork mode and see that most of the time they are not
   * reaching the node.
   *
   * The workaround for this is to just issue balanceOf calls each second until we get the
   * expected 0 balance OUSD on the contract.
   *
   */
  const queryDataUntilAccountChange = async () => {
    let ousdBalance = compensationOUSDBalance
    while (ousdBalance !== 0) {
      ousdBalance = await fetchAllData(active, account, compensationContract)
      await sleep(1000)
    }
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
    queryDataUntilAccountChange,
    remainingOUSDCompensation: compensationOUSDBalance,
    blockNumber,
  }
}

export default useCompensation
