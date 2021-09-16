import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'
import { find, sortBy } from 'lodash'
import { useStoreState } from 'pullstate'
import { formatCurrency } from 'utils/math'

import ContractStore from 'stores/ContractStore'
import ConfirmContractPickModal from 'components/buySell/ConfirmContractPickModal'

const ContractsTable = () => {
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const [alternateTxRouteConfirmed, setAlternateTxRouteConfirmed] =
    useState(false)
  const [showAlternateRouteModal, setShowAlternateRouteModal] = useState(false)
  const [
    alternateRouteEstimationSelected,
    setAlternateRouteEstimationSelected,
  ] = useState(null)
  const [showAllContracts, setShowAllContracts] = useState(false)
  const { active: walletActive } = useWeb3React()

  const swapContracts = {
    flipper: {
      name: fbt('OUSD Swap', 'Contract Table OUSD Swap'),
    },
    vault: {
      name: fbt('Origin Vault', 'Contract Table Origin Vault'),
    },
    uniswap: {
      name: fbt('Uniswap V3', 'Contract Table Uniswap V3'),
    },
    curve: {
      name: fbt('Curve', 'Contract Table Curve'),
    },
    uniswapV2: {
      name: fbt('Uniswap V2', 'Contract Table Uniswap V2'),
    },
    sushiswap: {
      name: fbt('SushiSwap', 'Contract Table SushiSwap'),
    },
  }

  const errorMap = {
    unsupported: fbt('Unsupported', 'Swap estimations: unsupported'),
    unexpected_error: fbt('Error', 'Swap estimations: unexpected_error'),
    not_enough_funds_contract: fbt(
      'Amount too high',
      'Swap estimations: amount too hight'
    ),
    not_enough_funds_user: fbt(
      'Insufficient balance',
      'Swap estimations: user does not have enough funds'
    ),
    amount_too_high: fbt(
      'Amount too high',
      'Swap estimations: amount too hight'
    ),
    slippage_too_high: fbt(
      'Slippage too high',
      'Swap estimations: slippage too hight'
    ),
  }

  // Defines the sorting order of errored items
  const errorSortMap = {
    unsupported: 3,
    unexpected_error: 4,
    not_enough_funds_contract: 0,
    not_enough_funds_user: 2,
    amount_too_high: 1,
  }

  const swapEstimationsReady =
    swapEstimations && typeof swapEstimations === 'object'

  const sortSwapEstimations = (swapEstimations) => {
    const estimations = Object.values(swapEstimations)
    const canDoEstimations = estimations.filter((e) => e.canDoSwap)
    const errorEstimations = estimations.filter((e) => !e.canDoSwap)

    return [
      ...sortBy(Object.values(canDoEstimations), (e) => e.effectivePrice).map(
        (e) => e.name
      ),
      ...sortBy(
        Object.values(errorEstimations),
        (e) => errorSortMap[e.error]
      ).map((e) => e.name),
    ]
  }

  let contractOrder = swapEstimationsReady
    ? sortSwapEstimations(swapEstimations)
    : Object.keys(swapContracts)

  contractOrder = showAllContracts ? contractOrder : contractOrder.splice(0, 3)

  const userSelectionExists =
    swapEstimationsReady &&
    find(
      Object.values(swapEstimations),
      (estimation) => estimation.userSelected
    ) !== undefined

  const selectedEstimation = find(swapEstimations, (estimation) =>
    userSelectionExists ? estimation.userSelected : estimation.isBest
  )

  const usedContractName = selectedEstimation
    ? swapContracts[selectedEstimation.name].name
    : '...'

  const numberOfCanDoSwaps = swapEstimationsReady
    ? Object.values(swapEstimations).filter((e) => e.canDoSwap).length
    : 0

  const setUserSelectedRoute = (swapName) => {
    ContractStore.update((s) => {
      const allSwaps = Object.keys(swapEstimations)
      allSwaps.forEach((swap) => {
        s.swapEstimations[swap].userSelected = false
      })

      s.swapEstimations[swapName].userSelected = true
    })
  }

  const loading = swapEstimations === 'loading'
  const empty = swapEstimations === null

  return (
    walletActive && (
      <div className="contracts-table">
        {showAlternateRouteModal && (
          <ConfirmContractPickModal
            onClose={() => {
              setShowAlternateRouteModal(false)
              setAlternateRouteEstimationSelected(null)
            }}
            bestEstimation={selectedEstimation}
            estimationSelected={alternateRouteEstimationSelected}
            nameMapping={swapContracts}
            setConfirmAlternateRoute={(isConfirmed) => {
              if (isConfirmed) {
                setUserSelectedRoute(alternateRouteEstimationSelected.name)
              }

              setAlternateTxRouteConfirmed(isConfirmed)
            }}
          />
        )}
        <div className="d-flex flex-column">
          <div className="contracts-table-top">
            <div className="title">
              {empty &&
                fbt(
                  'Best price will be displayed here',
                  'Best price displayed transaction table'
                )}
              {loading &&
                fbt(
                  'Finding you the best price...',
                  'Finding the best price for your transaction'
                )}
              {!empty &&
                !loading &&
                fbt(
                  'Best price for your transaction',
                  'Contracts table best price for transaction'
                )}
            </div>
          </div>
          {/* <div className="subtitle"> */}
          {/*   {selectedEstimation && */}
          {/*     fbt( */}
          {/*       'Your transaction will use contract: ' + */}
          {/*         fbt.param('contract used', usedContractName), */}
          {/*       'Info of picked contract for the swap' */}
          {/*     )} */}
          {/*   {!selectedEstimation && */}
          {/*     fbt( */}
          {/*       'Enter your amounts above to see which contract is best for your swap', */}
          {/*       'Info when no contract is yet picked' */}
          {/*     )} */}
          {/* </div> */}
        </div>
        <div className="d-flex flex-column contracts-table-bottom">
          <div className="d-flex title-row">
            <div className="w-28">
              {fbt('Exchange', 'Contract Table Exchange Name')}
            </div>
            <div className="w-18 text-right">
              {fbt('Est. received', 'Contract Table Est. received')}
            </div>
            <div className="w-18 text-right">
              {fbt('Gas estimate', 'Contract Table Gas estimate')}
            </div>
            <div className="w-18 text-right">
              {fbt('Effective Price', 'Contract Table Effective Price')}
            </div>
            <div className="w-18 text-right">
              {fbt('Diff.', 'Contract Table Diff')}
            </div>
          </div>
          {contractOrder.map((contract) => {
            const swapContract = swapContracts[contract]
            const estimation = swapEstimationsReady
              ? swapEstimations[contract]
              : null

            const isError = estimation && !estimation.canDoSwap
            const errorReason = isError && estimation.error
            const canDoSwap = estimation && estimation.canDoSwap

            let status
            let redStatus = false
            if (loading) {
              status = fbt('Loading ...', 'Swap estimations: loading...')
            } else if (empty) {
              status = '-'
            } else if (isError) {
              status = errorMap[errorReason]
            } else if (canDoSwap) {
              if (estimation.isBest) {
                status = fbt('Best', 'Swap estimations best one')
              } else {
                status = `- ${formatCurrency(
                  estimation.diffPercentage * -1,
                  2
                )}%`
                redStatus = true
              }
            }

            const loadingOrEmpty = loading || empty
            const isSelected =
              canDoSwap &&
              (userSelectionExists
                ? estimation.userSelected
                : estimation.isBest)
            const isViableOption =
              canDoSwap && numberOfCanDoSwaps > 1 && !isSelected

            return (
              <div
                className={`d-flex content-row ${
                  isViableOption ? 'clickable' : ''
                } ${canDoSwap && isSelected ? 'selected' : ''}`}
                key={swapContract.name}
                onClick={() => {
                  if (!isViableOption) {
                    return
                  }

                  if (!alternateTxRouteConfirmed) {
                    setShowAlternateRouteModal(estimation.name)
                    setAlternateRouteEstimationSelected(estimation)
                    return
                  }

                  setUserSelectedRoute(estimation.name)
                }}
              >
                <div className="w-28 contract-name">{swapContract.name}</div>
                <div className="w-18 text-right">
                  {loadingOrEmpty
                    ? '-'
                    : formatCurrency(estimation.amountReceived, 2)}
                </div>
                <div className="w-18 text-right">
                  {loadingOrEmpty || !canDoSwap
                    ? '-'
                    : `$${formatCurrency(estimation.gasEstimate, 2)}`}
                </div>
                <div className="w-18 text-right">
                  {loadingOrEmpty || !canDoSwap
                    ? '-'
                    : `$${formatCurrency(estimation.effectivePrice, 2)}`}
                </div>
                <div
                  className={`text-right pl-2 text-nowrap w-18 ${
                    redStatus ? 'red' : ''
                  }`}
                >
                  {empty ? '-' : status}
                </div>
              </div>
            )
          })}
          <a
            className="show-more-less text-center"
            onClick={() => {
              setShowAllContracts(!showAllContracts)
              ContractStore.update((s) => {
                s.showAllContracts = !showAllContracts
              })
            }}
          >
            {showAllContracts
              ? fbt('Show less', 'Show less contracts button')
              : fbt('Show more', 'Show more contracts button')}
          </a>
        </div>
        <style jsx>{`
          .contracts-table {
            color: #8293a4;
            font-size: 14px;
            border-radius: 10px;
            background-color: #fafbfc;
            box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
            margin-top: 20px;
            position: relative;
          }

          .contracts-table-top {
            border-radius: 10px 10px 0 0;
            border: solid 1px #cdd7e0;
            padding: 30px 0 0 30px;
            border-bottom: 0px;
            background-color: white;
          }

          .contracts-table-bottom {
            border-radius: 0 0 10px 10px;
            border: solid 1px #cdd7e0;
            padding: 30px;
            background-color: #fafbfc;
          }

          .w-28 {
            width: 28%;
          }

          .w-18 {
            width: 18%;
          }

          .title {
            color: #8293a4;
            font-size: 16px;
            margin-bottom: 20px;
          }

          .subtitle {
            margin-bottom: 36px;
          }

          .contract-name {
            font-weight: bold;
          }

          .title-row {
            color: #8293a4;
            font-size: 12px;
            margin-bottom: 18px;
            padding-right: 30px;
            padding-left: 20px;
          }

          .content-row {
            color: black;
            font-size: 14px;
            padding: 16px 20px;
            margin-bottom: 10px;
            border: solid 1px #cdd7e0;
            border-radius: 10px;
          }

          .content-row.selected {
            background-color: white;
            border: solid 1px black;
            box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.2);
          }

          .red {
            color: #ff0000;
          }

          .clickable {
            cursor: pointer;
          }

          .clickable:hover {
            background-color: #eaeaea;
          }

          .content-row.selected.clickable:hover {
            background-color: #eae6c9;
          }

          .show-more-less {
            color: #1a82ff;
            cursor: pointer;
          }

          .show-more-less:hover {
            text-decoration: underline;
          }

          @media (max-width: 799px) {
            .contracts-table-top {
              padding: 20px 0 0 20px;
            }

            .contracts-table-bottom {
              padding: 20px;
            }

            .title {
              margin-bottom: 6px;
            }

            .subtitle {
              margin-bottom: 20px;
            }

            .title-row {
              padding-right: 20px;
            }

            .contracts-table {
              margin-top: 20px;
              padding: 20px 0;
            }
          }
        `}</style>
      </div>
    )
  )
}

export default ContractsTable
