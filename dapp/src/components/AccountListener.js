import React, { useState, useEffect } from 'react'
import ethers from 'ethers'
import { useCookies } from 'react-cookie'
import { useWeb3React } from '@web3-react/core'

import { AccountStore } from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library } = web3react
  const prevAccount = usePrevious(account)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])

  const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

  const loadData = async (contracts) => {
    if (!account) {
      return
    }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(web3react)) {
      return
    }

    const { usdt, dai, tusd, usdc, ousd, vault } = contracts

    const loadBalances = async () => {
      if (!account) return

      //console.log("DEbug: ", ousd.balanceOf, usdt.balanceOf, ousd, usdt, dai, tusd, usdc)
      try {
        const [ousdBalance, usdtBalance, daiBalance, tusdBalance, usdcBalance] = await Promise.all([
          displayCurrency(await ousd.balanceOf(account), ousd),
          displayCurrency(await usdt.balanceOf(account), usdt),
          displayCurrency(await dai.balanceOf(account), dai),
          displayCurrency(await tusd.balanceOf(account), tusd),
          displayCurrency(await usdc.balanceOf(account), usdc),
        ])

        //console.log("DEbug1: ", ousd, usdt, dai, tusd, usdc)
        AccountStore.update((s) => {
          s.balances = {
            usdt: usdtBalance,
            dai: daiBalance,
            tusd: tusdBalance,
            usdc: usdcBalance,
            ousd: ousdBalance,
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account balances: ',
          e
        )
      }
    }

    const loadAllowances = async () => {
      if (!account) return

      try {
        const [usdtAllowance, daiAllowance, tusdAllowance, usdcAllowance, ousdAllowance] = await Promise.all([
          displayCurrency(
            await usdt.allowance(account, vault.address),
            usdt
          ),
          displayCurrency(
            await dai.allowance(account, vault.address),
            dai
          ),
          displayCurrency(
            await tusd.allowance(account, vault.address),
            tusd
          ),
          displayCurrency(
            await usdc.allowance(account, vault.address),
            usdc
          ),
          displayCurrency(
            await ousd.allowance(account, vault.address),
            ousd
          )
        ])

        AccountStore.update((s) => {
          s.allowances = {
            usdt: usdtAllowance,
            dai: daiAllowance,
            tusd: tusdAllowance,
            usdc: usdcAllowance,
            ousd: ousdAllowance
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account allowances: ',
          e
        )
      }
    }

    await loadBalances()
    await loadAllowances()
  }

  useEffect(() => {
    if (account) {
      login(account, setCookie)
    }

    if (window.balanceInterval) {
      clearInterval(window.balanceInterval)
    }

    const setupContractsAndLoad = async () => {
      const contracts = await setupContracts(account, library)
      loadData(contracts)
      
      window.balanceInterval = setInterval(() => {
        loadData(contracts)
      //}, 14000)
      }, 5000)
    }

    setupContractsAndLoad()
  }, [account, chainId])

  return ''
}

export default AccountListener
