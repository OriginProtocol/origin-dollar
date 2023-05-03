import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { ethers, BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import ErrorModal from 'components/buySell/ErrorModal'
import { currencies } from '../../constants/Contract'
import withRpcProvider from 'hoc/withRpcProvider'
import WrapOETHPill from 'components/wrap/WrapOETHPill'
import PillArrow from 'components/buySell/_PillArrow'
import withIsMobile from 'hoc/withIsMobile'
import { getUserSource } from 'utils/user'
import usePrevious from 'utils/usePrevious'
import ApproveSwap from 'components/buySell/ApproveSwap'
import { useWeb3React } from '@web3-react/core'

import analytics from 'utils/analytics'
import {
  formatCurrencyMinMaxDecimals,
  removeCommas,
  displayCurrency,
  calculateSwapAmounts,
} from '../../utils/math'

const lastSelectedSwapModeKey = 'last_user_selected_wrap_mode'

const WrapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  // mint / redeem
  const [swapMode, setSwapMode] = useState(
    process.browser ? localStorage.getItem(lastSelectedSwapModeKey) : 'mint'
  )
  const previousSwapMode = usePrevious(swapMode)
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)

  const [inputAmount, setInputAmount] = useState('')
  const [balanceError, setBalanceError] = useState(null)

  const wrappingGloballyDisabled = process.env.DISABLE_WRAP_BUTTON === 'true'

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const allowancesLoaded =
    typeof allowances === 'object' && allowances.oeth !== undefined

  const [wrapEstimate, setWrapEstimate] = useState('')
  const [needsApproval, setNeedsApproval] = useState()
  const [rate, setRate] = useState()

  const account = useStoreState(AccountStore, (s) => s.address)
  const web3react = useWeb3React()
  const { library } = web3react

  const { oeth, woeth } = useStoreState(ContractStore, (s) => s.contracts)

  const signer = (contract) => {
    return contract.connect(library.getSigner(account))
  }

  useEffect(() => {
    if (!woeth) {
      return
    }
    const wrapEstimate = async () => {
      let estimate
      if (!inputAmount) {
        estimate = 0
      } else if (swapMode === 'mint') {
        estimate = await displayCurrency(
          await woeth.convertToShares(
            calculateSwapAmounts(inputAmount, 18).swapAmount
          ),
          woeth
        )
      } else {
        estimate = await displayCurrency(
          await woeth.convertToAssets(
            calculateSwapAmounts(inputAmount, 18).swapAmount
          ),
          oeth
        )
      }
      setWrapEstimate(estimate)
    }
    const approvalNeeded = () => {
      if (!allowancesLoaded) {
        return
      }
      setNeedsApproval(
        parseFloat(allowances.oeth.woeth) < inputAmount ? 'woeth' : ''
      )
    }
    const calculateRate = async () => {
      const conversionRate = await displayCurrency(
        await woeth.convertToAssets(calculateSwapAmounts(1, 18).swapAmount),
        woeth
      )
      setRate(conversionRate)
    }
    wrapEstimate()
    approvalNeeded()
    calculateRate()
  }, [inputAmount, woeth, oeth, allowances, allowancesLoaded])

  useEffect(() => {
    // currencies flipped
    if (previousSwapMode !== swapMode) {
      localStorage.setItem(lastSelectedSwapModeKey, swapMode)
      if (inputAmount) {
        setInputAmount(wrapEstimate)
      }
      setInputAmount(wrapEstimate)
    }
  }, [swapMode])

  const errorMap = [
    {
      errorCheck: (err) => {
        return err.name === 'EthAppPleaseEnableContractData'
      },
      friendlyMessage: fbt(
        'Contract data not enabled. Go to Ethereum app Settings and set "Contract Data" to "Allowed"',
        'Enable contract data'
      ),
    },
    {
      errorCheck: (err) => {
        return err.message.includes(
          'Failed to sign with Ledger device: U2F DEVICE_INELIGIBL'
        )
      },
      friendlyMessage: fbt(
        'Can not detect ledger device. Please make sure your Ledger is unlocked and Ethereum App is opened.',
        'See ledger connected'
      ),
    },
  ]

  const onMintingError = (error) => {
    if (errorMap.filter((eMap) => eMap.errorCheck(error)).length > 0) {
      setBuyErrorToDisplay(error)
    }
  }

  const swapMetadata = () => {
    const coinGiven = swapMode === 'mint' ? 'woeth' : 'oeth'
    const coinReceived = swapMode === 'mint' ? 'oeth' : 'woeth'
    const swapAmount = swapMode === 'mint' ? inputAmount : wrapEstimate
    const coinUsed = 'woeth'
    return {
      coinGiven,
      coinReceived,
      swapAmount,
      coinUsed,
    }
  }

  const onWrapOETH = async () => {
    analytics.track(
      swapMode === 'mint' ? 'On Wrap to wETH' : 'On Unwrap from wETH',
      {
        category: 'wrap',
        label: swapMetadata.coinUsed,
        value: swapMetadata.swapAmount,
      }
    )

    const metadata = swapMetadata()

    try {
      let result

      if (swapMode === 'mint') {
        result = await signer(woeth).deposit(
          calculateSwapAmounts(inputAmount, 18).swapAmount,
          account
        )
      } else {
        result = await signer(woeth).redeem(
          calculateSwapAmounts(inputAmount, 18).swapAmount,
          account,
          account
        )
      }

      storeTransaction(
        result,
        swapMode === 'mint' ? 'unwrap' : 'wrap',
        'woeth',
        {
          oeth: inputAmount,
          woeth: inputAmount,
        }
      )
      setStoredCoinValuesToZero()
      setInputAmount('')

      await rpcProvider.waitForTransaction(result.hash)
      analytics.track('Wrap succeeded', {
        category: 'wrap',
        label: metadata.coinUsed,
        value: metadata.swapAmount,
      })
    } catch (e) {
      const metadata = swapMetadata()
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(swapMode, 'oeth')
        analytics.track('Wrap failed', {
          category: 'wrap',
          label: e.message,
        })
      } else {
        analytics.track('Wrap canceled', {
          category: 'wrap',
        })
      }

      onMintingError(e)
      console.error('Error wrapping oeth! ', e)
    }
  }

  // TODO: modify this
  const setStoredCoinValuesToZero = () => {
    Object.values(currencies).forEach(
      (c) => (localStorage[c.localStorageSettingKey] = '0')
    )
  }

  return (
    <>
      {process.browser && (
        <>
          <div className="wrap-homepage d-flex flex-column flex-grow">
            {buyErrorToDisplay && (
              <ErrorModal
                error={buyErrorToDisplay}
                errorMap={errorMap}
                onClose={() => {
                  setBuyErrorToDisplay(false)
                }}
              />
            )}
            <WrapOETHPill
              swapMode={swapMode}
              onAmountChange={async (amount) => {
                setInputAmount(amount)
              }}
              coinValue={inputAmount}
              rate={rate}
              topItem
              onErrorChange={setBalanceError}
            />
            <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
            <WrapOETHPill swapMode={swapMode} wrapEstimate={wrapEstimate} />
            <ApproveSwap
              stableCoinToApprove={swapMode === 'mint' ? 'oeth' : 'woeth'}
              needsApproval={needsApproval}
              selectedSwap={{ name: 'woeth' }}
              inputAmount={inputAmount}
              swapMetadata={swapMetadata()}
              onSwap={() => onWrapOETH()}
              allowancesLoaded={allowancesLoaded}
              onMintingError={onMintingError}
              balanceError={balanceError}
              swapsLoaded={true}
              swappingGloballyDisabled={wrappingGloballyDisabled}
            />
          </div>
          <style jsx>{`
            .wrap-homepage {
              margin: 0px -1px -1px -1px;
              border: solid 1px #141519;
              border-radius: 10px;
              background-color: #1e1f25;
              min-height: 350px;
              padding: 35px 40px 40px 40px;
              position: relative;
            }

            @media (max-width: 799px) {
              .wrap-homepage {
                padding: 23px 20px 20px 20px;
              }
            }
          `}</style>
        </>
      )}
    </>
  )
}

export default withIsMobile(withRpcProvider(WrapHomepage))
