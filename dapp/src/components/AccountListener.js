import React, { useState, useEffect } from 'react'
import ethers, { BigNumber } from 'ethers'
import { useCookies } from 'react-cookie'
import { useWeb3React } from '@web3-react/core'
import _ from 'lodash'

import AccountStore from 'stores/AccountStore'
import PoolStore from 'stores/PoolStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'
import { mergeDeep } from 'utils/utils'
import { displayCurrency } from 'utils/math'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library, active } = web3react
  const prevAccount = usePrevious(account)
  const prevActive = usePrevious(active)
  const [contracts, setContracts] = useState(null)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const userActive = useStoreState(AccountStore, (s) => s.active)
  const isDevelopment = process.env.NODE_ENV === 'development'

  useEffect(() => {
    if (prevActive && !active) {
      AccountStore.update((s) => {
        s.allowances = {}
        s.balances = {}
      })
      PoolStore.update((s) => {
        s.claimable_ogn = null
        s.lp_tokens = null
        s.lp_token_allowance = null
        s.staked_lp_tokens = null
        s.your_weekly_rate = null
      })
    }
  }, [active])

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

    const {
      usdt,
      dai,
      usdc,
      ousd,
      vault,
      ogn,
      uniV2OusdUsdt,
      liquidityOusdUsdt,
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

    const loadPoolRelatedAccountData = async () => {
      if (!account) return

      const pools = PoolStore.currentState.pools
      const initializedPools = pools.filter((pool) => pool.contract)

      if (pools.length !== initializedPools.length) {
        console.warn(
          'When loading account pool data not all pools have yet initialized'
        )
      }

      // contract needs to be populated?

      // await poolContract.userInfo(account)
      // await displayCurrency(userInfo.amount, lpContract)
      try {
        const additionalPoolData = await Promise.all(
          pools.map(async (pool) => {
            const { lpContract, contract, pool_deposits_bn } = pool
            const additionalData = {
              name: pool.name,
              coin_one: {},
              coin_two: {},
            }

            if (isDevelopment) {
              const token1Contract =
                contracts[pool.coin_one.contract_variable_name]
              const token2Contract =
                contracts[pool.coin_two.contract_variable_name]

              const [
                coin1Allowance,
                coin2Allowance,
                coin1Balance,
                coin2Balance,
              ] = await Promise.all([
                displayCurrency(
                  await token1Contract.allowance(account, lpContract.address),
                  token1Contract
                ),
                displayCurrency(
                  await token2Contract.allowance(account, lpContract.address),
                  token2Contract
                ),
                displayCurrency(
                  await token1Contract.balanceOf(account),
                  token1Contract
                ),
                displayCurrency(
                  await token2Contract.balanceOf(account),
                  token2Contract
                ),
              ])

              additionalData.coin_one.allowance = coin1Allowance
              additionalData.coin_two.allowance = coin2Allowance
              additionalData.coin_one.balance = coin1Balance
              additionalData.coin_two.balance = coin2Balance
              additionalData.coin_one.contract = token1Contract
              additionalData.coin_two.contract = token2Contract
            }

            const [
              userInfo,
              unclaimedOgn,
              lp_tokens,
              lp_token_allowance,
              rewardPerBlockBn,
              userReward,
              poolDepositsBn,
            ] = await Promise.all([
              await contract.userInfo(account),
              displayCurrency(await contract.pendingRewards(account), ogn),
              displayCurrency(await lpContract.balanceOf(account), lpContract),
              displayCurrency(
                await lpContract.allowance(account, contract.address),
                lpContract
              ),
              await contract.rewardPerBlock(),
              displayCurrency(await contract.pendingRewards(account), ogn),
              await lpContract.balanceOf(contract.address),
            ])

            const userTokensStaked = await displayCurrency(
              userInfo.amount,
              lpContract
            )

            additionalData.claimable_ogn = unclaimedOgn
            additionalData.lp_tokens = lp_tokens
            additionalData.lp_token_allowance = lp_token_allowance
            additionalData.staked_lp_tokens = userTokensStaked
            additionalData.pool_deposits = await displayCurrency(
              poolDepositsBn,
              lpContract
            )
            additionalData.reward_per_block = await displayCurrency(
              rewardPerBlockBn,
              ogn
            )

            const userTokensStakedNumber = Number(userTokensStaked)
            /* userTokensStaked / total pool deposits = the share of the pool a user owns
             * Multiplied by rewards per block times number of blocks in a week
             */
            additionalData.your_weekly_rate =
              userTokensStakedNumber === 0 || poolDepositsBn.isZero()
                ? 0
                : await displayCurrency(
                    userInfo.amount
                      /* in dev environment sometimes users can have more tokens staked than total pool token staked.
                       * that happens when user balance updates before the pool balance.
                       */
                      .div(poolDepositsBn)
                      .mul(rewardPerBlockBn)
                      .mul(BigNumber.from(6500 * 7)), // blocks in a day times 7 days in a week
                    ogn
                  )
            return additionalData
          })
        )

        const enrichedPools = PoolStore.currentState.pools.map((pool) => {
          const additionalData = additionalPoolData.filter(
            (apool) => apool.name === pool.name
          )[0]
          const merged = {
            ...pool,
            ...additionalData,
            coin_one: {
              ...pool.coin_one,
              ...additionalData.coin_one,
            },
            coin_two: {
              ...pool.coin_two,
              ...additionalData.coin_two,
            },
          }

          return merged
        })
        //console.log('Enriched pools', enrichedPools)
        PoolStore.update((s) => {
          s.pools = enrichedPools
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account specific data for pools',
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

    Promise.all([
      loadBalances(),
      loadAllowances(),
      // TODO maybe do this if only in the LM part of the dapp
      loadPoolRelatedAccountData(),
    ])
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
