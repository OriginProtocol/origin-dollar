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
import withRpcProvider from 'hoc/withRpcProvider'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library } = web3react
  const prevAccount = usePrevious(account)
  const [contracts, setContracts] = useState(null)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const userActive = useStoreState(AccountStore, (s) => s.active)
  // const fetchAllowances = useStoreState(AccountStore, (s) => s.fetchAllowances)

  const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

  const startEventListening = () => {
    function start() {
      const { usdt, dai, usdc, ousd, vault } = contracts
      const rpcProvider = props.rpcProvider

      // Setup event listening
      rpcProvider.on(
        dai.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, dai).then((b) =>
            AccountStore.update((s) => {
              s.allowances.dai = b
            })
          )
      )
      rpcProvider.on(
        usdt.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, usdt).then((b) =>
            AccountStore.update((s) => {
              s.allowances.usdt = b
            })
          )
      )
      rpcProvider.on(
        usdc.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, usdc).then((b) =>
            AccountStore.update((s) => {
              s.allowances.usdc = b
            })
          )
      )
      rpcProvider.on(
        ousd.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, ousd).then((b) =>
            AccountStore.update((s) => {
              s.allowances.ousd = b
            })
          )
      )

      // Poll one time
      Promise.all([
        ousd
          .allowance(account, vault.address)
          .then((b) => displayCurrency(b, ousd)),
        usdt
          .allowance(account, vault.address)
          .then((b) => displayCurrency(b, usdt)),
        dai
          .allowance(account, vault.address)
          .then((b) => displayCurrency(b, dai)),
        usdc
          .allowance(account, vault.address)
          .then((b) => displayCurrency(b, usdc)),
      ])
        .then((balances) =>
          AccountStore.update((s) => {
            s.allowances = {
              ousd: balances[0],
              usdt: balances[1],
              dai: balances[2],
              usdc: balances[3],
            }
          })
        )
        .catch((e) =>
          console.error(
            'AccountListener.js error - can not load account balances: ',
            e
          )
        )
    }

    function asyncStartWhenReady() {
      if (!account || !contracts || !isCorrectNetwork(chainId)) {
        setTimeout(asyncStartWhenReady, 100)
        return
      }
      start()
    }

    asyncStartWhenReady()

    return () => props.rpcProvider.removeAllListeners('Approval')
  }

  const loadData = async (contracts) => {
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
    await loadBalances()
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
        loadData(contracts)
      }, 1)
    }

    setupContractsAndLoad()
  }, [account, chainId])

  useEffect(() => {
    let balancesInterval
    let stopEventListening = () => 0
    if (contracts && userActive === 'active' && isCorrectNetwork(chainId)) {
      loadData(contracts)
      stopEventListening = startEventListening()
      balancesInterval = setInterval(() => {
        loadData(contracts)
      }, 7000)
    }

    return () => {
      stopEventListening()
      if (balancesInterval) {
        clearInterval(balancesInterval)
      }
    }
  }, [userActive, contracts])

  return ''
}

export default withRpcProvider(AccountListener)
