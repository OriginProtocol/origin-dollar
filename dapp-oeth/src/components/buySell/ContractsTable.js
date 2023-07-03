import React, { useState, useMemo } from 'react'
import { fbt } from 'fbt-runtime'
import { find, orderBy, isEmpty, capitalize } from 'lodash'
import { useStoreState } from 'pullstate'
import classnames from 'classnames'
import { useAccount } from 'wagmi'
import { formatCurrency } from 'utils/math'
import { assetRootPath } from 'utils/image'
import ContractStore from 'stores/ContractStore'
import ConfirmationModal from 'components/buySell/ConfirmationModal'
import { event } from '../../../lib/gtm'

const swapContracts = {
  zapper: {
    name: fbt('Zap + Vault', 'Contract Table Zap + Vault'),
  },
  vault: {
    name: fbt('OETH Vault', 'Contract Table OETH Vault'),
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
        'The OETH Vault only supports redeeming OETH for a mix of LSDs.',
        'unsupported-vault-mint'
      )

    case 'zapper':
      return swapMode === 'mint'
        ? fbt(
            'The Zap contract only supports minting with ETH and sfrxETH.',
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
            <div className="estimate-item invalid d-block">
              <div>
                <span className="big">0 OETH</span>
                <span className="small">(estimate)</span>
              </div>
              <div className="dash d-flex">
                <div className="dash-child">-</div>
                <span className="">-</span>
              </div>
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
                  <div
                    className={classnames('box-highlight-container', {
                      'd-none': !isBest && !isShowingMore,
                      'has-error': errorDisplay,
                      selected: isSelected,
                    })}
                  >
                    <button
                      key={name}
                      className={classnames('box-highlight', {
                        'd-none': !isBest && !isShowingMore,
                        'has-error': errorDisplay,
                        selected: isSelected,
                      })}
                      onClick={() => {
                        if (canDoSwap && !error && !isSelected) {
                          onSelect(estimate)
                          event({
                            event: 'change_swap_route',
                            change_route_to: name,
                          })
                        }
                      }}
                      disabled={errorDisplay || isSelected || !isActive}
                    >
                      <div className="d-flex top">
                        <div className="d-inline-flex align-items-center">
                          {amountReceived ? (
                            <>
                              <span className="estimate-value">
                                {parseFloat(amountReceived).toFixed(5)}{' '}
                                {coinToSwap === 'mix'
                                  ? 'LSD Mix'
                                  : coinToSwap?.toUpperCase()}
                              </span>
                              <span className="estimate-help">
                                {fbt('(estimate)', 'estimate help')}
                              </span>
                            </>
                          ) : (
                            <span className="estimate-value">0</span>
                          )}
                        </div>
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
                                {fbt(
                                  'Unsupported',
                                  'Swap estimate unsupported'
                                )}
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
                      </div>
                      <div className="estimate-item">
                        <div className="estimate">
                          {amountReceived ? (
                            <div className="fees-value">
                              <div
                                className="d-inline-block mr-2"
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
                                    `≈ $${formatCurrency(amountReceivedUsd, 2)}`
                                  )}`,
                                  'After Fee Price'
                                )}
                                <br className="d-block d-sm-none" />
                                <span className="ml-1">after fees</span>
                              </div>
                              <span className="d-none d-md-inline">
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
                          <span className="d-block d-md-none effective">
                            {fbt(
                              `Effective Price: ${fbt.param(
                                'effectivePriceDisplay',
                                `$${formatCurrency(effectivePrice, 2)}`
                              )}`,
                              'Effective Price'
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
                                          {parseFloat(gasEstimateEth)?.toFixed(
                                            4
                                          )}{' '}
                                          ETH{' '}
                                        </span>
                                      </span>
                                    )}
                                    <span>{capitalize(name)}</span>
                                  </>
                                )}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
              {sortedEstimates.reduce(
                (acc, el) => (el.canDoSwap ? ++acc : acc),
                0
              ) > 1 && (
                <button
                  className="show-hide"
                  onClick={() => {
                    setIsShowingMore((prev) => !prev)
                    if (!isShowingMore) {
                      event({ event: 'show_swap_routes' })
                    }
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
              )}
            </>
          )}
        </div>
      </div>
      <style jsx>
        {`
          .box-highlight-container {
            width: 100%;
            border-radius: 4px;
            margin-top: 8px;
            padding: 1px;
            cursor: pointer;
          }

          .box-highlight-container.selected,
          .box-highlight-container:hover .box-highlight-container:hover {
            background: linear-gradient(90deg, #b361e6 20.29%, #6a36fc 79.06%);
          }

          .dash {
            color: #8293a4;
            padding-top: 5px;
          }

          .dash-child {
            margin-right: 133px;
          }

          .invalid {
            padding: 16px 24px !important;
            border-radius: 4px;
            min-height: 95px;
          }

          .invalid .big {
            font-size: 14px;
            color: #fafafb;
            margin-right: 6px;
          }

          .invalid .small {
            font-size: 12px;
            color: #8293a4;
          }

          .top {
            background-color: #18191c;
            color: #fafbfb;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            padding: 16px 24px 0 24px;
            display: flex;
            justify-content: space-between;
          }

          .box-highlight {
            font-size: 12px;
            color: #8293a4;
          }

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
            width: 100%;
            background: #18191c;
            color: #fafbfb;
            padding: 5px 24px 16px 24px;
            border-radius: 0 0 4px 4px;
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

          .box-highlight.has-error {
            display: none;
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

          .estimate-value {
            display: flex;
            align-items: center;
            font-family: 'Sailec';
            font-style: normal;
            font-weight: 400;
            font-size: 14px !important;
            line-height: 17px;
            whitespace: nowrap;
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

          .status {
            font-family: 'Sailec';
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
            line-height: 17px;
            text-align: right;
          }

          .status.best {
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

          .status.diff,
          .status.error {
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
            width: 100%;
            background: #18191c !important;
            border-radius: 4px;
            border: none;
            padding: 0;
          }

          .box-highlight.selected:hover {
            opacity: 1;
          }

          .show-hide {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            padding: 4px 19px;
            margin-top: 16px;
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

          @media (max-width: 799px) {
            .estimates-container {
              padding: 0 12px;
            }

            .estimate-item,
            .estimates-empty,
            .estimates-loading {
              padding: 0 12px 16px 12px;
            }

            .estimate-value {
              font-size: 14px;
            }

            .top {
              padding: 16px 12px 0 12px;
            }
          }
        `}
      </style>
    </>
  )
}
const ContractsTable = () => {
  const { isConnected: active } = useAccount()

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
          margin-bottom: 0;
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
          .contracts-header {
            padding: 16px 12px;
          }

          .contracts-main {
            padding-bottom: 16px;
          }

          .contracts-wrapper {
            border-radius: 4px;
          }
        }
      `}</style>
    </div>
  )
}

export default ContractsTable
