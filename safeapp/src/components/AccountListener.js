import React, { useEffect } from 'react'
import _ from 'lodash'

import AccountStore from '../stores/AccountStore'
import { displayCurrency } from '../utils/math'

const AccountListener = (props) => {
  const { account, contracts} = props
  const refetchUserData = AccountStore.useState( s => s.refetchUserData )

  const loadData = async (contracts) => {
    if (!account) {
      return
    }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }

    const {
      usdt,
      dai,
      usdc,
      ousd,
      vault,
      ogn,
      uniV2OusdUsdt,
      liquidityOusdUsdt,
      ognStaking,
      ognStakingView,
    } = contracts

    const loadBalances = async () => {
      if (!account) return

      try {
        const [
          ousdBalance,
          usdtBalance,
          daiBalance,
          usdcBalance,
          ognBalance,
        ] = await Promise.all([
          displayCurrency(await ousd.balanceOf(account), ousd),
          displayCurrency(await usdt.balanceOf(account), usdt),
          displayCurrency(await dai.balanceOf(account), dai),
          displayCurrency(await usdc.balanceOf(account), usdc),
          displayCurrency(await ogn.balanceOf(account), ogn),
        ])

        AccountStore.update((s) => {
          s.balances = {
            usdt: usdtBalance,
            dai: daiBalance,
            usdc: usdcBalance,
            ousd: ousdBalance,
            ogn: ognBalance,
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account balances: ',
          e
        )
      }
    }

    await loadBalances();
  }

  useEffect(() => {
    console.log("refresh changed:", refetchUserData);
    if (refetchUserData) {
      setTimeout( () => { console.log("loading balances from refresh.."); loadData(contracts); }, 1000);
      AccountStore.update((s) => {
          s.refetchUserData = false;
        })
    }
  }, [contracts, refetchUserData]);

  useEffect(() => {
    let balancesInterval
    if (contracts && account) {
      loadData(contracts)

      balancesInterval = setInterval(() => {
        loadData(contracts)
      }, 7000)
    }

    return () => {
      if (balancesInterval) {
        clearInterval(balancesInterval)
      }
    }
  }, [account, contracts])

  return null
}

export default AccountListener
