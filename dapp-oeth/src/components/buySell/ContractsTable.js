import React, { useState, useMemo } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'
import { find, orderBy, isEmpty, capitalize } from 'lodash'
import { useStoreState } from 'pullstate'
import classnames from 'classnames'
import { formatCurrency } from 'utils/math'
import { assetRootPath } from 'utils/image'
import ContractStore from 'stores/ContractStore'
import ConfirmationModal from 'components/buySell/ConfirmationModal'

const swapContracts = {
  zapper: {
    name: fbt('Zapper', 'Contract Table Zapper'),
  },
  vault: {
    name: fbt('Origin Vault', 'Contract Table Origin Vault'),
  },
  // uniswap: {
  //   name: fbt('Uniswap V3', 'Contract Table Uniswap V3'),
  // },
  curve: {
    name: fbt('Curve', 'Contract Table Curve'),
  },
  // uniswapV2: {
  //   name: fbt('Uniswap V2', 'Contract Table Uniswap V2'),
  // },
  // sushiswap: {
  //   name: fbt('SushiSwap', 'Contract Table SushiSwap'),
  // },
}

const errorMap = {
  unsupported: fbt('Unsupported', 'Swap estimations: unsupported'),
  unexpected_error: fbt(
    'Unexpected error',
    'Swap estimations: unexpected_error'
  ),
  not_enough_funds_contract: fbt(
    'Liquidity error',
    'Swap estimations: liquidity error'
  ),
  not_enough_funds_user: fbt(
    'Insufficient balance',
    'Swap estimations: user does not have enough funds'
  ),
  amount_too_high: fbt('Amount too high', 'Swap estimations: amount too high'),
  liquidity_error: fbt('Liquidity error', 'Swap estimations: liquidity error'),
  price_too_high: fbt('Price too high', 'Swap estimations: price too high'),
}

// Defines the sorting order of errored items
const errorSortMap = {
  unsupported: 3,
  unexpected_error: 4,
  not_enough_funds_contract: 0,
  not_enough_funds_user: 2,
  amount_too_high: 1,
}

const sortByError = ({ error }) => errorSortMap?.[error] || Infinity

const unsupportedDisplay = (estimateName, swapMode) => {
  switch (estimateName) {
    case 'vault':
      return fbt(
        'The Origin Vault only supports redeeming OETH for a mix of LSDs.',
        'unsupported-vault-mint'
      )

    case 'zapper':
      return swapMode === 'mint'
        ? fbt(
            'Zapper only supports minting with ETH and sfrxETH.',
            'unsupported-zapper-mint'
          )
        : fbt('This route does not support OETH redeem.', 'unsupported-redeem')

    case 'curve':
      return swapMode === 'mint'
        ? fbt('Curve only supports ETH and OETH.', 'unsupported-curve-mint')
        : fbt(
            'This route only supports OETH redeem to ETH.',
            'unsupported-curve-redeem'
          )

    default:
      return swapMode === 'mint'
        ? fbt('Unsupported route', 'unsupported-default-mint')
        : fbt(
            'This route does not support OETH redeem.',
            'unsupported-default-redeem'
          )
  }
}
const Estimates = ({ estimates, selected, isLoading, isActive, onSelect }) => {
  const [isShowingMore, setIsShowingMore] = useState(false)

  const sortedEstimates = useMemo(() => {
    if (typeof estimates !== 'object') return []
    return orderBy(estimates, [sortByError, 'effectivePrice'], ['desc', 'asc'])
  }, [JSON.stringify(estimates)])

  const hasValidEstimates =
    sortedEstimates.findIndex(({ isBest }) => isBest) > -1

  return (
    <>
      <div className="estimates-container">
        <div className="sorted-estimates-container">
          {isLoading ? (
            <div className="estimates-loading">Loading...</div>
          ) : isEmpty(sortedEstimates) ? (
            <div className="estimate-item invalid">
              <img
                className="mr-2"
                src={assetRootPath('/images/warn.png')}
                alt="Warning icon"
              />
              <span>
                {fbt(
                  'Enter an amount to view swap route estimates.',
                  'Invalid amount'
                )}
              </span>
            </div>
          ) : (
            <>
              {!hasValidEstimates && (
                <div className="estimate-item invalid">
                  <img
                    className="mr-2"
                    src={assetRootPath('/images/warn.png')}
                    alt="Warning icon"
                  />
                  <span>
                    {fbt(
                      'Currently no supported swaps for selected pair',
                      'Invalid swap'
                    )}
                  </span>
                </div>
              )}
              {sortedEstimates?.map((estimate) => {
                const {
                  name,
                  isBest,
                  canDoSwap,
                  error,
                  amountReceived,
                  approveAllowanceNeeded,
                  effectivePrice,
                  gasEstimate,
                  gasEstimateApprove,
                  gasEstimateSwap,
                  diff,
                  diffPercentage,
                  gasEstimateEth,
                  amountReceivedUsd,
                  coinToSwap,
                  swapMode,
                } = estimate
                const hasDiff = diff > 0
                const isSelected = selected?.name === name
                const errorDisplay = errorMap?.[error]
                return (
                  <button
                    key={name}
                    className={classnames('estimate-item box-highlight', {
                      'd-none': !isBest && !isShowingMore,
                      'has-error': errorDisplay,
                      selected: isSelected,
                    })}
                    onClick={() => {
                      if (canDoSwap && !error && !isSelected) {
                        onSelect(estimate)
                      }
                    }}
                    disabled={errorDisplay || isSelected || !isActive}
                  >
                    <div className="estimate">
                      <div className="d-inline-flex align-items-center">
                        {amountReceived ? (
                          <>
                            <span className="estimate-value">
                              {amountReceived}{' '}
                              {coinToSwap === 'mix'
                                ? 'LSD Mix'
                                : coinToSwap?.toUpperCase()}
                            </span>
                            <span className="estimate-help">
                              {fbt('(estimate)', 'estimate help')}
                            </span>
                          </>
                        ) : (
                          <span className="estimate-value">-</span>
                        )}
                      </div>
                      {amountReceived ? (
                        <div className="fees-value">
                          <span
                            className="mr-2"
                            title={
                              approveAllowanceNeeded
                                ? `${fbt(
                                    `Includes 2 transactions Approve($${fbt.param(
                                      'Approve Cost',
                                      formatCurrency(gasEstimateApprove, 2)
                                    )}) + Swap($${fbt.param(
                                      'Swap Cost',
                                      formatCurrency(gasEstimateSwap, 2)
                                    )})`,
                                    'Swap & approve transaction gas estimation'
                                  )}`
                                : ''
                            }
                          >
                            {fbt(
                              `${fbt.param(
                                'afterFeeDisplay',
                                `≈ $${formatCurrency(
                                  amountReceivedUsd,
                                  2
                                )} after fees`
                              )}`,
                              'After Fee Price'
                            )}{' '}
                            <span>{approveAllowanceNeeded ? '*' : ''}</span>
                          </span>
                          <span>
                            {fbt(
                              `Effective Price: ${fbt.param(
                                'effectivePriceDisplay',
                                `$${formatCurrency(effectivePrice, 2)}`
                              )}`,
                              'Effective Price'
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="fees-value">-</span>
                      )}
                    </div>
                    <div className="additional">
                      <span
                        className={classnames('status', {
                          best: isBest,
                          error: !!error,
                          diff: hasDiff,
                        })}
                      >
                        {isBest ? (
                          fbt('Best', 'Swap estimations best one')
                        ) : error === 'unsupported' ? (
                          <>
                            <span className="mr-1">{capitalize(name)}</span>
                            <span>
                              {fbt('Unsupported', 'Swap estimate unsupported')}
                            </span>
                          </>
                        ) : errorDisplay ? (
                          <>
                            <span className="mr-1">{capitalize(name)}</span>
                            <span>{fbt('Error', 'Swap estimate error')}</span>
                          </>
                        ) : hasDiff ? (
                          `- ${formatCurrency(diffPercentage * -1, 2)}%`
                        ) : (
                          ''
                        )}
                      </span>
                      <span className="info-value">
                        {error === 'unsupported'
                          ? unsupportedDisplay(name, swapMode)
                          : errorDisplay || (
                              <>
                                {gasEstimateEth && (
                                  <span className="mr-2">
                                    <img
                                      className="mr-2"
                                      src={assetRootPath('/images/gas.png')}
                                      alt="gas price icon"
                                    />
                                    <span>
                                      {parseFloat(gasEstimateEth)?.toFixed(4)}{' '}
                                      ETH{' '}
                                      {`(≈ $${formatCurrency(gasEstimate, 2)})`}
                                    </span>
                                  </span>
                                )}
                                <span>{capitalize(name)}</span>
                              </>
                            )}
                      </span>
                    </div>
                  </button>
                )
              })}
              <button
                className="show-hide"
                onClick={() => {
                  setIsShowingMore((prev) => !prev)
                }}
              >
                {isShowingMore ? (
                  <>
                    <span>{fbt('show less', 'hide')}</span>
                    <img
                      className="ml-2"
                      src={assetRootPath('/images/uparrow.png')}
                      alt="up arrow icon"
                    />
                  </>
                ) : (
                  <>
                    <span>{fbt('show more', 'show more')}</span>
                    <img
                      className="ml-2"
                      style={{ transform: 'rotate(180deg)' }}
                      src={assetRootPath('/images/uparrow.png')}
                      alt="up arrow icon"
                    />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
      <style jsx>
        {`
          .estimates-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            align-items: center;
            justify-center: center;
            padding: 0 40px;
          }

          .sorted-estimates-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            align-items: center;
            justify-center: center;
          }

          .sorted-estimates-container .estimate-item + .estimate-item {
            margin-top: 8px;
          }

          .estimate-item,
          .estimates-empty,
          .estimates-loading {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            height: 77px;
            width: 100%;
            background: #18191c;
            border-radius: 4px;
            color: #fafbfb;
            padding: 16px 24px;
            border: none;
          }

          .estimates-loading {
            color: #828699;
            align-items: center;
          }

          .estimate-item.invalid {
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            align-items: center;
            color: #fafbfb;
            font-family: 'Sailec';
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
          }

          .estimate-item.has-error {
            opacity: 0.5;
            pointer: cursor-not-allowed;
          }

          .estimate-item .estimate {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
          }

          .estimate-item .additional {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
          }

          .estimate .estimate-value {
            display: flex;
            align-items: center;
            font-family: 'Sailec';
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
            line-height: 17px;
          }

          .estimate-help {
            margin-left: 6px;
            font-family: 'Inter';
            font-style: normal;
            font-weight: 400;
            font-size: 12px;
            line-height: 20px;
            color: #828699;
          }

          .estimate .fees-value {
            font-family: 'Inter';
            font-style: normal;
            font-weight: 400;
            font-size: 12px;
            line-height: 20px;
            color: #828699;
            margin-top: 4px;
          }

          .additional .status {
            font-family: 'Sailec';
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
            line-height: 17px;
            text-align: right;
          }

          .additional .status.best {
            background: linear-gradient(
                97.67deg,
                #66fe90 -10.09%,
                #66d9fe 120.99%
              ),
              #61e886;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-fill-color: transparent;
          }

          .additional .status.diff,
          .additional .status.error {
            color: #ff4e4e;
          }

          .additional .info-value {
            display: flex;
            flex-direction: row;
            font-family: 'Inter';
            font-style: normal;
            font-weight: 400;
            font-size: 12px;
            line-height: 20px;
            color: #828699;
            margin-top: 4px;
          }

          .box-highlight {
            position: relative;
          }

          .box-highlight.selected::before,
          .box-highlight:not(.has-error):hover::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 4px;
            border: 1px solid transparent;
            background: linear-gradient(90deg, #b361e6 20.29%, #6a36fc 79.06%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box,
              linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
          }

          .show-hide {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            padding: 4px 19px;
            margin-top: 20px;
            height: 28px;
            max-width: 120px;
            background: rgba(255, 255, 255, 0.1);
            box-shadow: 0px 27px 80px rgba(0, 0, 0, 0.07),
              0px 6.0308px 17.869px rgba(0, 0, 0, 0.0417275),
              0px 1.79553px 5.32008px rgba(0, 0, 0, 0.0282725);
            border-radius: 28px;
            flex: none;
            order: 1;
            flex-grow: 0;
            color: #fafbfb;
            font-size: 12px;
            font-weight: 500;
            border: none;
          }
        `}
      </style>
    </>
  )
}
const ContractsTable = () => {
  const { active } = useWeb3React()

  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)

  const [alternateTxRouteConfirmed, setAlternateTxRouteConfirmed] =
    useState(false)

  const [showAlternateRouteModal, setShowAlternateRouteModal] = useState(false)

  const [
    alternateRouteEstimationSelected,
    setAlternateRouteEstimationSelected,
  ] = useState(null)

  const swapEstimationsReady =
    swapEstimations && typeof swapEstimations === 'object'

  const userSelectionExists =
    swapEstimationsReady &&
    find(
      Object.values(swapEstimations),
      (estimation) => estimation.userSelected
    ) !== undefined

  const selectedEstimation = find(swapEstimations, (estimation) =>
    userSelectionExists ? estimation.userSelected : estimation.isBest
  )

  const setUserSelectedRoute = (swapName) => {
    ContractStore.update((s) => {
      const allSwaps = Object.keys(swapEstimations)
      allSwaps.forEach((swap) => {
        s.swapEstimations[swap].userSelected = false
      })

      s.swapEstimations[swapName].userSelected = true
    })
  }

  const setConfirmAlternateRoute = (isConfirmed) => {
    if (isConfirmed) {
      setUserSelectedRoute(alternateRouteEstimationSelected.name)
      ContractStore.update((s) => {
        s.lastOverride = alternateRouteEstimationSelected.name
      })
    }
    setAlternateTxRouteConfirmed(isConfirmed)
  }

  const onSelectEstimate = (estimation) => {
    if (!alternateTxRouteConfirmed) {
      setShowAlternateRouteModal(estimation.name)
      setAlternateRouteEstimationSelected(estimation)
      return
    }

    ContractStore.update((s) => {
      s.lastOverride = estimation.name
    })
    setUserSelectedRoute(estimation.name)
  }

  return (
    <div className="contracts-wrapper">
      <div className="contracts-header">
        <h2 className="title">{fbt('Swap Routes', 'Swap Routes')}</h2>
      </div>
      <div className="contracts-main">
        <Estimates
          estimates={swapEstimations}
          selected={selectedEstimation}
          isLoading={swapEstimations === 'loading'}
          onSelect={onSelectEstimate}
          isActive={active}
        />
      </div>
      {showAlternateRouteModal && (
        <ConfirmationModal
          onConfirm={() => {
            setConfirmAlternateRoute(true)
            setShowAlternateRouteModal(false)
            setAlternateRouteEstimationSelected(null)
          }}
          onClose={() => {
            setConfirmAlternateRoute(false)
            setShowAlternateRouteModal(false)
            setAlternateRouteEstimationSelected(null)
          }}
          description={
            fbt(
              fbt.param(
                'selected estimation name',
                swapContracts[alternateRouteEstimationSelected.name].name
              ) +
                ' offers -' +
                fbt.param(
                  'selected estimation diff',
                  formatCurrency(
                    alternateRouteEstimationSelected.diffPercentage * -1,
                    2
                  )
                ) +
                '% ' +
                ' worse price than ' +
                fbt.param(
                  'best estimation name',
                  swapContracts[selectedEstimation.name].name
                ) +
                '.',
              'Selected vs best estimation comparison'
            ) +
            ' ' +
            fbt(
              'Are you sure you want to override best transaction route?',
              'transaction route override prompt'
            )
          }
          declineBtnText={fbt('No', 'Not confirm')}
          confirmBtnText={fbt('Yes', 'I confirm')}
        />
      )}
      <style jsx>{`
        .contracts-wrapper {
          margin-top: 12px;
          border: solid 1px #141519;
          border-radius: 10px;
          background-color: #1e1f25;
          position: relative;
          overflow: hidden;
        }

        .contracts-header {
          display: flex;
          align-center: center;
          justify-content: space-between;
          padding: 28px 40px;
          width: 100%;
        }

        .contracts-header .title {
          color: #fafbfb;
          font-size: 14px;
        }

        .contracts-main {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          padding-bottom: 28px;
        }

        .show-more-less {
          color: #fafbfb;
          cursor: pointer;
          margin-top: 10px;
        }

        .show-more-less:hover {
          text-decoration: underline;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </div>
  )
}

export default ContractsTable
