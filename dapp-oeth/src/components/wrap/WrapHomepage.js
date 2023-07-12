import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import ErrorModal from 'components/buySell/ErrorModal'
import { currencies } from '../../constants/Contract'
import withRpcProvider from 'hoc/withRpcProvider'
import WrapOETHPill from 'components/wrap/WrapOETHPill'
import PillArrow from 'components/buySell/_PillArrow'
import useEthPrice from 'hooks/useEthPrice'
import withIsMobile from 'hoc/withIsMobile'
import usePrevious from 'utils/usePrevious'
import ApproveSwap from 'components/buySell/ApproveSwap'
import { event } from '../../../lib/gtm'
import { displayCurrency, calculateSwapAmounts } from '../../utils/math'
import { assetRootPath } from '../../utils/image'
import { useAccount, useSigner } from 'wagmi'

const lastSelectedSwapModeKey = 'last_user_selected_wrap_mode'

const WrapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  // mint / redeem
  const [swapMode, setSwapMode] = useState(
    process.browser && localStorage.getItem(lastSelectedSwapModeKey) !== null
      ? localStorage.getItem(lastSelectedSwapModeKey)
      : 'mint'
  )

  const previousSwapMode = usePrevious(swapMode)
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)

  const [inputAmount, setInputAmount] = useState('')
  const [balanceError, setBalanceError] = useState(null)

  const ethPrice = useEthPrice()

  const wrappingGloballyDisabled = process.env.DISABLE_WRAP_BUTTON === 'true'

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const allowancesLoaded =
    typeof allowances === 'object' && allowances.oeth !== undefined

  const [wrapEstimate, setWrapEstimate] = useState('')
  const [needsApproval, setNeedsApproval] = useState()
  const [rate, setRate] = useState()

  const { data: activeSigner } = useSigner()
  const { address: account } = useAccount()

  const { oeth, woeth } = useStoreState(ContractStore, (s) => s.contracts)

  const signer = (contract) => {
    return contract.connect(activeSigner)
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
      if (swapMode === 'mint') {
        setNeedsApproval(
          parseFloat(allowances.oeth.woeth) < inputAmount ? 'woeth' : ''
        )
      }
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
    const wrapTokenUsed = swapMode === 'mint' ? 'woeth' : 'oeth'
    const wrapTokenAmount = swapMode === 'mint' ? inputAmount : wrapEstimate
    // mint = wrap
    event({
      event: 'wrap_started',
      wrap_token: wrapTokenUsed,
      wrap_amount: wrapTokenAmount,
    })

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
      event({
        event: 'wrap_complete',
        wrap_type: swapMode,
        wrap_token: wrapTokenUsed,
        wrap_amount: wrapTokenAmount,
      })
    } catch (e) {
      const metadata = swapMetadata()
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(swapMode, 'oeth')
        event({
          event: 'wrap_failed',
          wrap_type: swapMode,
          wrap_token: wrapTokenUsed,
          wrap_amount: wrapTokenAmount,
        })
      } else {
        event({
          event: 'wrap_rejected',
          wrap_type: swapMode,
          wrap_token: wrapTokenUsed,
          wrap_amount: wrapTokenAmount,
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
        <div className="wrap-homepage d-flex flex-column mt-4">
          <div className="wrap-help">
            <p className="info">
              Wrapped wOETH is a non-rebasing tokenized vault that appreciates
              in value instead of growing in number.
            </p>
            <a
              href="https://docs.oeth.com/core-concepts/wrapped-ousd"
              className="btn-blue learn-more"
              target="_blank"
              rel="noreferrer"
            >
              <span className="text">Learn more</span>
              <img
                className="icon"
                src={assetRootPath('/images/external-link-white.svg')}
                alt="Navigate to OETH home page"
              />
            </a>
          </div>
          <div className="wrap-wrapper">
            <p className="title">Wrap</p>
            <div className="swap-wrapper d-flex flex-column flex-grow">
              {buyErrorToDisplay && (
                <ErrorModal
                  error={buyErrorToDisplay}
                  errorMap={errorMap}
                  onClose={() => {
                    setBuyErrorToDisplay(false)
                  }}
                />
              )}
              <div className="wrap-main">
                <WrapOETHPill
                  swapMode={swapMode}
                  onAmountChange={async (amount) => {
                    setInputAmount(amount)
                  }}
                  coinValue={inputAmount}
                  rate={rate}
                  topItem
                  onErrorChange={setBalanceError}
                  ethPrice={ethPrice}
                />
                <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
                <WrapOETHPill
                  swapMode={swapMode}
                  wrapEstimate={wrapEstimate}
                  ethPrice={ethPrice}
                />
              </div>
            </div>
          </div>
          <ApproveSwap
            coinToApprove={swapMode === 'mint' ? 'oeth' : 'woeth'}
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
          <style jsx>{`
            .wrap-help {
              display: flex;
              flex-direction: column;
              justify-content: center;
              border: solid 1px #141519;
              border-radius: 10px;
              background-color: #1e1f25;
              min-height: 115px;
              margin: 10px 0 18px 0;
              color: #fafafb;
              padding: 28px 40px;
            }

            .wrap-help .info {
              font-size: 12px;
              font-weight: 400;
              line-height: 20px;
              letter-spacing: 0em;
              text-align: left;
            }

            .wrap-help .learn-more {
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              border-radius: 100px;
              height: 32px;
              font-size: 12px;
              font-weight: 500;
              line-height: 20px;
              letter-spacing: 0em;
              text-align: left;
              width: 113px;
            }

            .wrap-help .learn-more .text {
              width: 65px;
              margin-right: 8px;
              flex-shrink: 0;
            }

            .wrap-help .learn-more .icon {
              flex-shrink: 0;
            }

            .wrap-wrapper {
              border: solid 1px #141519;
              border-radius: 10px;
              background-color: #1e1f25;
            }

            .wrap-homepage {
              border: solid 1px #141519;
              border-radius: 10px;
              width: 100%;
              position: relative;
              overflow: hidden;
              width: 100%;
            }

            .wrap-homepage .title {
              font-size: 14px;
              padding: 28px 40px;
              margin: 0;
              color: #fafafb;
            }

            .wrap-main {
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }

            @media (max-width: 799px) {
              .wrap-homepage {
                margin-top: 16px !important;
                border-radius: 4px;
              }

              .wrap-homepage .title {
                padding: 16px;
              }

              .wrap-help {
                padding: 16px;
              }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

export default withIsMobile(withRpcProvider(WrapHomepage))
