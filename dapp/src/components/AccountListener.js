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
  const isDevelopment = process.env.NODE_ENV === 'development'

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
    if (!isCorrectNetwork(chainId)) {
      return
    }

    const { usdt, dai, usdc, ousd, vault, ogn, uniV2OusdUsdt, liquidityOusdUsdt } = contracts

    const loadBalances = async () => {
      if (!account) return

      try {
        const [
          ousdBalance,
          usdtBalance,
          daiBalance,
          usdcBalance,
          ognBalance,
          uniV2OusdUsdtBalance
        ] = await Promise.all([
          displayCurrency(await ousd.balanceOf(account), ousd),
          displayCurrency(await usdt.balanceOf(account), usdt),
          displayCurrency(await dai.balanceOf(account), dai),
          displayCurrency(await usdc.balanceOf(account), usdc),
          displayCurrency(await ogn.balanceOf(account), ogn),
          displayCurrency(await uniV2OusdUsdt.balanceOf(account), uniV2OusdUsdt)
        ])

        AccountStore.update((s) => {
          s.balances = {
            usdt: usdtBalance,
            dai: daiBalance,
            usdc: usdcBalance,
            ousd: ousdBalance,
            ogn: ognBalance,
            uniV2OusdUsdt: uniV2OusdUsdtBalance
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account balances: ',
          e
        )
      }
    }

    const loadTokensStaked = async () => {
      if (!account) return

      try {
        const [
          liquidityOusdUsdtStaked
        ] = await Promise.all([
          displayCurrency((await liquidityOusdUsdt.userInfo(account)).amount, uniV2OusdUsdt)
        ])

        AccountStore.update((s) => {
          s.lpTokensStaked = {
            uniV2OusdUsdt: liquidityOusdUsdtStaked
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load staked tokens: ',
          e
        )
      }
    }

    const loadUnclaimedOgn = async () => {
      if (!account) return

      try {
        const [
          liquidityOusdUsdtUclaimedOgn
        ] = await Promise.all([
          displayCurrency((await liquidityOusdUsdt.pendingRewards(account)), ognx)
        ])
        
        AccountStore.update((s) => {
          s.ognToBeClaimed = {
            uniV2OusdUsdt: liquidityOusdUsdtUclaimedOgn
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load unclaimed OGN tokens: ',
          e
        )
      }
    }

    const loadAllowances = async () => {
      if (!account) return

      try {
        const allowances = {}
        allowances.uniV2OusdUsdt = {}

        const [
          usdtAllowance,
          daiAllowance,
          usdcAllowance,
          ousdAllowance,
          uniV2OusdUsdtAllowance,
        ] = await Promise.all([
          displayCurrency(await usdt.allowance(account, vault.address), usdt),
          displayCurrency(await dai.allowance(account, vault.address), dai),
          displayCurrency(await usdc.allowance(account, vault.address), usdc),
          displayCurrency(await ousd.allowance(account, vault.address), ousd),
          displayCurrency(await uniV2OusdUsdt.allowance(account, liquidityOusdUsdt.address), uniV2OusdUsdt)
        ])

        if (isDevelopment) {
          const [ousdUniAllowance, usdtUniAllowance] = await Promise.all([
            displayCurrency(await ousd.allowance(account, uniV2OusdUsdt.address), ousd),
            displayCurrency(await usdt.allowance(account, uniV2OusdUsdt.address), usdt)
          ])

          allowances.uniV2OusdUsdt.ousd = ousdUniAllowance
          allowances.uniV2OusdUsdt.usdt = usdtUniAllowance
        }

        AccountStore.update((s) => {
          s.allowances = {
            ...allowances,
            usdt: usdtAllowance,
            dai: daiAllowance,
            usdc: usdcAllowance,
            ousd: ousdAllowance,
            uniV2OusdUsdt: uniV2OusdUsdtAllowance
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
    // TODO maybe do this if only in the LM part of the dapp
    await loadTokensStaked()
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
    if (contracts && userActive === 'active' && isCorrectNetwork(chainId)) {
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
  }, [userActive, contracts])

  return ''
}

export default AccountListener
