import React, { useState, useEffect } from 'react'
import { BigNumber } from 'ethers'
import { useCookies } from 'react-cookie'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import PoolStore from 'stores/PoolStore'
import StakeStore from 'stores/StakeStore'
import { usePrevious, useOverrideAccount } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'
import { displayCurrency } from 'utils/math'
import { isDevelopment } from 'constants/env'
import useBalancesQuery from '../queries/useBalancesQuery'
import useAllowancesQuery from '../queries/useAllowancesQuery'
import useApyQuery from '../queries/useApyQuery'
import useTransactionHistoryPageQuery from '../queries/useTransactionHistoryPageQuery'
import useWOETHQuery from '../queries/useWOETHQuery'
import { transactionHistoryItemsPerPage } from 'utils/constants'
import { useAccount, useNetwork } from 'wagmi'

const AccountListener = (props) => {
  const { chain } = useNetwork()
  const {
    connector: activeConnector,
    address: web3Account,
    isConnected: active,
  } = useAccount()

  const chainId = chain?.id

  const { overrideAccount } = useOverrideAccount()
  const account = overrideAccount || web3Account
  const prevAccount = usePrevious(account)
  const prevActive = usePrevious(active)
  const [contracts, setContracts] = useState(null)
  const [setCookie] = useCookies(['loggedIn'])

  const {
    active: userActive,
    refetchUserData,
    refetchStakingData,
  } = useStoreState(AccountStore, (s) => s)
  const prevRefetchStakingData = usePrevious(refetchStakingData)
  const prevRefetchUserData = usePrevious(refetchUserData)

  const balancesQuery = useBalancesQuery(account, contracts, {
    onSuccess: (balances) => {
      AccountStore.update((s) => {
        s.balances = balances
      })
    },
  })

  const allowancesQuery = useAllowancesQuery(account, contracts, {
    onSuccess: (allowances) => {
      AccountStore.update((s) => {
        s.allowances = allowances
      })
    },
  })

  const woethQuery = useWOETHQuery(account, contracts, {
    onSuccess: (woethValue) => {
      AccountStore.update((s) => {
        s.woethValue = woethValue
      })
    },
  })

  const apyQuery = useApyQuery({
    onSuccess: (apy) => {
      ContractStore.update((s) => {
        s.apy = apy
      })
    },
  })

  const historyPageQuery = useTransactionHistoryPageQuery(
    account,
    transactionHistoryItemsPerPage,
    1,
    []
  )

  useEffect(() => {
    if ((prevActive && !active) || prevAccount !== account) {
      AccountStore.update((s) => {
        s.allowances = {}
        s.balances = {}
      })
      ContractStore.update((s) => {
        s.walletConnected = false
      })
      PoolStore.update((s) => {
        s.claimable_ogn = null
        s.lp_tokens = null
        s.lp_token_allowance = null
        s.staked_lp_tokens = null
        s.your_weekly_rate = null
      })
      StakeStore.update((s) => {
        s.stakes = null
        s.airDropStakeClaimed = false
      })
    }
  }, [active, prevActive, account, prevAccount])

  useEffect(() => {
    const fetchVaultThresholds = async () => {
      if (!contracts) return

      const vault = contracts.vault
      const allocateThreshold = await vault.autoAllocateThreshold()
      const rebaseThreshold = await vault.rebaseThreshold()

      ContractStore.update((s) => {
        s.vaultAllocateThreshold = allocateThreshold
        s.vaultRebaseThreshold = rebaseThreshold
      })
    }

    fetchVaultThresholds()
  }, [contracts])

  const loadData = async (contracts, { onlyStaking } = {}) => {
    if (!account) {
      return
    }
    // if (!contracts.ogn.provider) {
    //   console.warn('Contract provider not yet set')
    //   return
    // }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(chainId)) {
      return
    }

    const { oeth, ogn, ognStakingView } = contracts

    const loadPoolRelatedAccountData = async () => {
      if (!account) return
      if (process.env.NEXT_PUBLIC_ENABLE_LIQUIDITY_MINING !== 'true') return

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

    const loadRebaseStatus = async () => {
      if (!account) return
      // TODO handle other contract types. We only detect Gnosis Safe as having
      // opted out here as rebaseState will always be 0 for all EOAs
      const isSafe = activeConnector?.id === 'safe'

      AccountStore.update((s) => {
        s.isSafe = isSafe
      })

      const rebaseOptInState = await oeth.rebaseState(account)

      AccountStore.update((s) => {
        s.rebaseOptedOut = isSafe && rebaseOptInState === 0
      })
    }

    balancesQuery.refetch()
    allowancesQuery.refetch()
    woethQuery.refetch()

    await Promise.all([
      loadRebaseStatus(),
      // TODO maybe do this if only in the LM part of the dapp since it is very heavy
      loadPoolRelatedAccountData(),
      // loadStakingRelatedData(),
    ])
  }

  useEffect(() => {
    if (account) {
      login(account, setCookie)
      historyPageQuery.refetch()
    }

    const loadLifetimeEarnings = async () => {
      if (!account) return

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
        }/api/v2/oeth/address/${account.toLowerCase()}/yield`
      )

      if (response !== undefined && response.ok) {
        const lifetimeYield = (await response.json()).lifetime_yield
        AccountStore.update((s) => {
          s.lifetimeYield = lifetimeYield
        })
      }
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
      let usedChainId
      if (chainId && isCorrectNetwork(chainId)) {
        usedChainId = chainId
      } else {
        usedChainId = parseInt(process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID)
      }

      window.fetchId = window.fetchId ? window.fetchId : 0
      window.fetchId += 1
      apyQuery.refetch()

      const contracts = await setupContracts(
        account,
        usedChainId,
        window.fetchId
      )
      setContracts(contracts)

      setTimeout(() => {
        loadData(contracts)
      }, 1)
    }

    setupContractsAndLoad()
    loadLifetimeEarnings()
  }, [account, chainId])

  useEffect(() => {
    // trigger a force refetch user data when the flag is set by a user
    if (
      (contracts && isCorrectNetwork(chainId),
      refetchUserData && !prevRefetchUserData)
    ) {
      loadData(contracts)
    }
    AccountStore.update((s) => {
      s.refetchUserData = false
    })
  }, [userActive, contracts, refetchUserData, prevRefetchUserData])

  useEffect(() => {
    // trigger a force refetch user data when the flag is set by a user
    if (
      (contracts && isCorrectNetwork(chainId),
      refetchStakingData && !prevRefetchStakingData)
    ) {
      loadData(contracts, { onlyStaking: true })
    }
    AccountStore.update((s) => {
      s.refetchStakingData = false
    })
  }, [userActive, contracts, refetchStakingData, prevRefetchStakingData])

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
