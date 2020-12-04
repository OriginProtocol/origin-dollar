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

  const pollOnce = (contracts) => {
    const { usdt, dai, usdc, ousd, vault } = contracts

    Promise.all([
      // balance
      ousd.balanceOf(account).then((b) => displayCurrency(b, ousd)),
      usdt.balanceOf(account).then((b) => displayCurrency(b, usdt)),
      dai.balanceOf(account).then((b) => displayCurrency(b, dai)),
      usdc.balanceOf(account).then((b) => displayCurrency(b, usdc)),

      // allowance
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
      .then((data) => {
        // balance
        AccountStore.update((s) => {
          s.balances = {
            ousd: data[0],
            usdt: data[1],
            dai: data[2],
            usdc: data[3],
          }
        })

        // allowance
        AccountStore.update((s) => {
          s.allowances = {
            ousd: data[4],
            usdt: data[5],
            dai: data[6],
            usdc: data[7],
          }
        })
      })
      .catch((e) =>
        console.error(
          'AccountListener.js error - can not load account balances: ',
          e
        )
      )
  }

  const subscribeToEvents = (contracts) => {
    // Polls data first time, then rely on events
    const { usdt, dai, usdc, ousd, vault } = contracts
    const rpcProvider = props.rpcProvider
    const pollNTimes = (n,promiseFn) => {
      if (n === 0) return
      // Poll every 5 seconds
      setTimeout(() => {
        promiseFn().then(pollNTimes(n-1, promiseFn))  
      }, 5000)
    }

    const updateOnAllowanceEvent = (contract, name) =>
      rpcProvider.on(
        contract.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, contract).then((allowance) =>
            AccountStore.update((s) => {
              s.allowances[name] = allowance
            }
                                                     ))
      )
    // Subscribe to Transfer event. Then poll balance once event received
    const updateOnTransferEvent = (contract, name) => {
      // Account sends tokens
      rpcProvider.on(
        contract.filters.Transfer(account, null, null), // event Transfer(address indexed from, address indexed to, uint tokens);
        (result) => pollNTimes(5, () =>
          contract
            .balanceOf(account)
            .then((balance) => displayCurrency(balance, contract))
            .then((balance) =>
                  AccountStore.update((s) => {s.balances[name] = balance})
                 ))
      )
      // Account receives tokens
      rpcProvider.on(
        contract.filters.Transfer(null, account, null), // event Transfer(address indexed from, address indexed to, uint tokens);
        (result) => pollNTimes(5, () =>
          contract
            .balanceOf(account)
            .then((balance) => displayCurrency(balance, contract))
            .then((balance) => 
                  AccountStore.update((s) => {s.balances[name] = balance})
                 ))
      )
    }

    // balance
    updateOnTransferEvent(ousd, 'ousd')
    updateOnTransferEvent(dai, 'dai')
    updateOnTransferEvent(usdt, 'usdt')
    updateOnTransferEvent(usdc, 'usdc')

    // allowance
    updateOnAllowanceEvent(ousd, 'ousd')
    updateOnAllowanceEvent(dai, 'dai')
    updateOnAllowanceEvent(usdt, 'usdt')
    updateOnAllowanceEvent(usdc, 'usdc')
  }

  useEffect(() => {
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
    }
    
    if (account) {
      login(account, setCookie)
    }
    setupContractsAndLoad()
  }, [account, chainId])
  
  useEffect(() => {
    if (
      account &&
      contracts &&
      userActive === 'active' &&
      isCorrectNetwork(chainId)
    ) {
      pollOnce(contracts)
      subscribeToEvents(contracts)
    }

    return () => {
      // Stop event listening
      props.rpcProvider.removeAllListeners('Transfer')
      props.rpcProvider.removeAllListeners('Approval')
    }
  }, [userActive, contracts])

  return ''
}

export default withRpcProvider(AccountListener)
