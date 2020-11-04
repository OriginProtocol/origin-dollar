import React, { useState, useEffect } from 'react'
import ethers from 'ethers'
import { useCookies } from 'react-cookie'
import { useWeb3React } from '@web3-react/core'

import AccountStore from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library } = web3react
  const prevAccount = usePrevious(account)
  const [contracts, setContracts] = useState(null)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const userActive = useStoreState(AccountStore, (s) => s.active)

  const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

  const pollData = async (contracts, firstTime) => {
    if (!account) {
      return
    }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(chainId)) {
      return
    }

    const { usdt, dai, usdc, ousd, vault } = contracts

    const loadBalances = async () => {
      if (!account) return
      try {
        const [
          ousdBalance,
          usdtBalance,
          daiBalance,
          usdcBalance,
        ] = await Promise.all([
          displayCurrency(await ousd.balanceOf(account), ousd),
          displayCurrency(await usdt.balanceOf(account), usdt),
          displayCurrency(await dai.balanceOf(account), dai),
          displayCurrency(await usdc.balanceOf(account), usdc),
        ])
        AccountStore.update((s) => {
          s.balances = {
            usdt: usdtBalance,
            dai: daiBalance,
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
        const [
          usdtAllowance,
          daiAllowance,
          usdcAllowance,
          ousdAllowance,
        ] = await Promise.all([
          displayCurrency(await usdt.allowance(account, vault.address), usdt),
          displayCurrency(await dai.allowance(account, vault.address), dai),
          displayCurrency(await usdc.allowance(account, vault.address), usdc),
          displayCurrency(await ousd.allowance(account, vault.address), ousd),
        ])

        AccountStore.update((s) => {
          s.allowances = {
            usdt: usdtAllowance,
            dai: daiAllowance,
            usdc: usdcAllowance,
            ousd: ousdAllowance,
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
    if (firstTime) {
      await loadAllowances()
    }
  }

  const subscribeEventData = async (contracts, firstTime) => {
    if (!account) {
      return
    }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(chainId)) {
      return
    }

    const { usdt, dai, usdc, ousd, vault } = contracts

    const startAllowanceEvents = async () => {
      const subscribeToApproval = async (_contract, stateAccessor) => {
        try {
          // https://docs.ethers.io/v5/api/contract/contract/#Contract-on
          _contract.on('Approval', async (owner, spender, allowance) => {
            if (!account) return
            if ((account === owner) & (spender === vault.address)) {
              allowance = await displayCurrency(allowance, usdt)
              const changeValue = (s, k, v) => {
                s[k] = v
                return s
              }
              AccountStore.update((s) => {
                s.allowances = changeValue(
                  s.allowances,
                  stateAccessor,
                  allowance
                )
              })
            }
          })
          return () => _contract.off('Approval', (v) => v)
        } catch (e) {
          console.error(
            'AccountListener.js error - can not load account allowances: ',
            e
          )
        }
        return () => 0
      }

      // subscribe to Allowance events and return functions to turn off each one
      const stopEventFns = await Promise.all([
        subscribeToApproval(usdt, 'usdt'),
        subscribeToApproval(dai, 'dai'),
        subscribeToApproval(usdc, 'usdc'),
        subscribeToApproval(ousd, 'ousd'),
      ])
      return () => stopEventFns.map((fn, i) => fn())
    }

    const stopAllowanceEvents = await startAllowanceEvents()
    return stopAllowanceEvents
  }

  useEffect(() => {
    if (account) {
      login(account, setCookie)
    }

    const setupContractsAndLoad = async () => {
      /* If we have a web3 provider present and is signed into the allowed network:
       * - NODE_ENV === production -> mainnet
       * - NODE_ENV === development -> localhost, forknet
       * then we use that chainId to setup contracts.
       *
       * In other case we still want to have read only capability of the contracts with a general provider
       * so we can fetch `getAPR` from Vault for example to use on marketing pages even when the user is not
       * logged in with a web3 provider.
       *
       */
      let usedChainId, usedLibrary
      if (chainId && isCorrectNetwork(chainId)) {
        usedChainId = chainId
        usedLibrary = library
      } else {
        usedChainId = parseInt(process.env.ETHEREUM_RPC_CHAIN_ID)
        usedLibrary = null
      }

      const contracts = await setupContracts(account, usedLibrary, usedChainId)
      setContracts(contracts)

      setTimeout(() => {
        pollData(contracts, true)
      }, 1)
    }

    setupContractsAndLoad()
  }, [account, chainId])

  useEffect(() => {
    let balancesInterval
    let stopEventData = () => 0
    if (contracts && userActive === 'active' && isCorrectNetwork(chainId)) {
      pollData(contracts, true)
      subscribeEventData(contracts).then((_stopEventData) => {
        stopEventData = _stopEventData
      })

      balancesInterval = setInterval(() => {
        pollData(contracts, false)
      }, 7000)
    }

    return () => {
      if (balancesInterval) {
        clearInterval(balancesInterval)
      }
      stopEventData()
    }
  }, [userActive, contracts])

  return ''
}

export default AccountListener
