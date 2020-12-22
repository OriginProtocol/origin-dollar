import React, { useState, useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useCookies } from 'react-cookie'
import { useWeb3React } from '@web3-react/core'
import _ from 'lodash'

import AccountStore from 'stores/AccountStore'
import PoolStore from 'stores/PoolStore'
import StakeStore from 'stores/StakeStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'
import { decorateContractStakeInfoWithTxHashes } from 'utils/stake'
import { mergeDeep } from 'utils/utils'
import { displayCurrency } from 'utils/math'
import withRpcProvider from 'hoc/withRpcProvider'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library, active } = web3react
  const prevAccount = usePrevious(account)
  const prevActive = usePrevious(active)
  const [contracts, setContracts] = useState(null)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const {
    active: userActive,
    refetchUserData,
    refetchStakingData,
  } = useStoreState(AccountStore, (s) => s)
  const durations = useStoreState(StakeStore, (s) => s.durations)
  const rates = useStoreState(StakeStore, (s) => s.rates)
  const prevRefetchStakingData = usePrevious(refetchStakingData)
  const prevRefetchUserData = usePrevious(refetchUserData)
  const isDevelopment = process.env.NODE_ENV === 'development'

  useEffect(() => {
    if ((prevActive && !active) || prevAccount !== account) {
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
      StakeStore.update((s) => {
        s.stakes = null
      })
    }
  }, [active, prevActive, account, prevAccount])

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
    const pollNTimes = (n, promiseFn) => {
      if (n === 0) return
      // Poll every 5 seconds
      setTimeout(() => {
        promiseFn().then(pollNTimes(n - 1, promiseFn))
      }, 5000)
    }

    const updateOnAllowanceEvent = (contract, name) =>
      rpcProvider.on(
        contract.filters.Approval(account, vault.address, null),
        (result) =>
          displayCurrency(result.data, contract).then((allowance) =>
            AccountStore.update((s) => {
              s.allowances[name] = allowance
            })
          )
      )
    // Subscribe to Transfer event. Then poll balance once event received
    const updateOnTransferEvent = (contract, name) => {
      // Account sends tokens
      rpcProvider.on(
        contract.filters.Transfer(account, null, null), // event Transfer(address indexed from, address indexed to, uint tokens);
        (result) =>
          pollNTimes(5, () =>
            contract
              .balanceOf(account)
              .then((balance) => displayCurrency(balance, contract))
              .then((balance) =>
                AccountStore.update((s) => {
                  s.balances[name] = balance
                })
              )
          )
      )
      // Account receives tokens
      rpcProvider.on(
        contract.filters.Transfer(null, account, null), // event Transfer(address indexed from, address indexed to, uint tokens);
        (result) =>
          pollNTimes(5, () =>
            contract
              .balanceOf(account)
              .then((balance) => displayCurrency(balance, contract))
              .then((balance) =>
                AccountStore.update((s) => {
                  s.balances[name] = balance
                })
              )
          )
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

  const loadData = async (contracts, { onlyStaking } = {}) => {
    if (!account) {
      return
    }
    if (!contracts.ogn.provider) {
      console.warn('Contract provider not yet set')
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
      ognStaking,
      ognStakingView,
    } = contracts

    const loadPoolRelatedAccountData = async () => {
      if (!account) return
      if (process.env.ENABLE_LIQUIDITY_MINING !== 'true') return

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

    const loadStakingRelatedData = async () => {
      if (!account) return

      try {
        /* OgnStakingView is used here instead of ognStaking because the first uses the jsonRpcProvider and
         * the latter the wallet one. Sometime these are not completely in sync and while the first one might
         * report a transaction already mined, the second one not yet.
         *
         * We use jsonRpcProvider to wait for transactions to be mined, so using the samne provider to fetch the
         * staking data solves the out of sync problem.
         */
        const stakes = await ognStakingView.getAllStakes(account)

        const decoratedStakes = stakes
          ? decorateContractStakeInfoWithTxHashes(stakes)
          : []

        StakeStore.update((s) => {
          s.stakes = decoratedStakes
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load staking related data: ',
          e
        )
      }
    }

    if (onlyStaking) {
      await loadStakingRelatedData()
    } else {
      await Promise.all([
        // TODO maybe do this if only in the LM part of the dapp since it is very heavy
        loadPoolRelatedAccountData(),
        loadStakingRelatedData(),
      ])
    }
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
    // trigger a force referch user data when the flag is set by a user
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
    // trigger a force referch user data when the flag is set by a user
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
    if (
      account &&
      contracts &&
      contracts.ogn.provider &&
      userActive === 'active' &&
      isCorrectNetwork(chainId)
    ) {
      loadData(contracts)

      balancesInterval = setInterval(() => {
        loadData(contracts)
      }, 7000)
      pollOnce(contracts)
      subscribeToEvents(contracts)
    }

    return () => {
      // Stop event listening
      props.rpcProvider.removeAllListeners('Transfer')
      props.rpcProvider.removeAllListeners('Approval')

      if (balancesInterval) {
        clearInterval(balancesInterval)
      }
    }
  }, [userActive, contracts])

  return ''
}

export default withRpcProvider(AccountListener)
