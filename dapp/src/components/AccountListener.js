import React, { useState, useEffect } from 'react'
import ethers from 'ethers'
import { useCookies } from 'react-cookie'

import { AccountStore } from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useWeb3React } from '@web3-react/core'
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
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(web3react)) {
      return
    }

    const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts

    const loadBalances = async () => {
      if (!account) return

      try {
        const [ousd, usdt, dai, tusd, usdc] = await Promise.all([
          displayCurrency(await OUSD.balanceOf(account), OUSD),
          displayCurrency(await MockUSDT.balanceOf(account), MockUSDT),
          displayCurrency(await MockDAI.balanceOf(account), MockDAI),
          displayCurrency(await MockTUSD.balanceOf(account), MockTUSD),
          displayCurrency(await MockUSDC.balanceOf(account), MockUSDC),
        ])

        AccountStore.update((s) => {
          s.balances = {
            usdt,
            dai,
            tusd,
            usdc,
            ousd,
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

      const [usdt, dai, tusd, usdc] = await Promise.all([
        displayCurrency(
          await MockUSDT.allowance(account, Vault.address),
          MockUSDT
        ),
        displayCurrency(
          await MockDAI.allowance(account, Vault.address),
          MockDAI
        ),
        displayCurrency(
          await MockTUSD.allowance(account, Vault.address),
          MockTUSD
        ),
        displayCurrency(
          await MockUSDC.allowance(account, Vault.address),
          MockUSDC
        ),
      ])

      AccountStore.update((s) => {
        s.allowances = {
          usdt,
          dai,
          tusd,
          usdc,
        }
      })
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

    if (!account) {
      return
    }

    const contracts = setupContracts(account, library)

    loadData(contracts)
    window.balanceInterval = setInterval(() => {
      loadData(contracts)
    //}, 14000)
    }, 5000)
  }, [account, chainId])

  return ''
}

export default AccountListener
