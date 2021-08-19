import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'
import { find, sortBy } from 'lodash'
import { useStoreState } from 'pullstate'
import { formatCurrency } from 'utils/math'

import ContractStore from 'stores/ContractStore'

const ContractsTable = () => {
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const [userCanPickTxRoute, setUserCanPickTxRoute] = useState(false)
  const [userSelectionConfirmed, setUserSelectionConfirmed] = useState(false)
  const { active: walletActive } = useWeb3React()
  useEffect(() => {
    setUserCanPickTxRoute(
      localStorage.getItem('override_best_tx_route') === 'true'
    )
  }, [])

  const swapContracts = {
    flipper: {
      name: fbt('OUSD Swap', 'Contract Table OUSD Swap'),
    },
    vault: {
      name: fbt('Origin Vault', 'Contract Table Origin Vault'),
    },
    uniswap: {
      name: fbt('Uniswap V3', 'Contract Table Uniswap'),
    },
  }

  const errorMap = {
    unsupported: fbt('Unsupported', 'Swap estimations: unsupported'),
    unexpected_error: fbt(
      'Unexpected Error',
      'Swap estimations: unexpected_error'
    ),
    not_enough_funds_contract: fbt(
      'Not available',
      'Swap estimations: not enough funds in contract'
    ),
    not_enough_funds_user: fbt(
      'Insufficient balance',
      'Swap estimations: user does not have enough funds'
    ),
    amount_too_high: fbt(
      'Amount too high',
      'Swap estimations: amount too hight'
    ),
  }

  const swapEstimationsReady =
    swapEstimations && typeof swapEstimations === 'object'
  const contractOrder = swapEstimationsReady
    ? sortBy(Object.values(swapEstimations), (e) => e.effectivePrice).map(
        (e) => e.name
      )
    : Object.keys(swapContracts)

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

  return (
    walletActive && (
      <>
        <div className="d-flex flex-column contracts-table">
          <div className="row-padding title">
            {fbt('Contracts', 'Contracts table title')}
          </div>
          <div className="row-padding subtitle">
            {fbt(
              'Your transaction will use contract: ' +
                fbt.param('contract used', usedContractName),
              'Info of picked contract for the swap'
            )}
          </div>
        </div>
        <div className="d-flex flex-column">
          <div className="d-flex title-row row-padding">
            <div className="w-28">{fbt('Name', 'Contract Table Name')}</div>
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
              {fbt('Diff', 'Contract Table Diff')}
            </div>
          </div>
          {contractOrder.map((contract) => {
            const swapContract = swapContracts[contract]
            const loading = swapEstimations === 'loading'
            const empty = swapEstimations === null
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
                status = `+ $${formatCurrency(estimation.diff, 2)}`
                redStatus = true
              }
            }

            const loadingOrEmpty = loading || empty
            const isViableOption = userCanPickTxRoute && canDoSwap
            const isSelected =
              canDoSwap &&
              (userSelectionExists
                ? estimation.userSelected
                : estimation.isBest)
            return (
              <div
                className={`d-flex content-row row-padding ${
                  isViableOption ? 'clickable' : ''
                } ${canDoSwap && isSelected ? 'selected' : ''}`}
                key={swapContract.name}
                onClick={() => {
                  if (!isViableOption) {
                    return
                  }

                  if (!userSelectionConfirmed) {
                    const result = window.confirm(
                      fbt(
                        'Are you sure you want to override best transaction route?',
                        'transaction route override prompt'
                      )
                    )
                    if (result) {
                      setUserSelectionConfirmed(true)
                    } else {
                      return
                    }
                  }

                  ContractStore.update((s) => {
                    const allSwaps = Object.keys(swapEstimations)
                    allSwaps.forEach((swap) => {
                      s.swapEstimations[swap].userSelected = false
                    })

                    s.swapEstimations[estimation.name].userSelected = true
                  })
                }}
              >
                <div className="w-28">{swapContract.name}</div>
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
                <div className={`text-right w-18 ${redStatus ? 'red' : ''}`}>
                  {empty ? '-' : status}
                </div>
              </div>
            )
          })}
        </div>
        <style jsx>{`
          .contracts-table {
            color: #8293a4;
            font-size: 14px;
          }

          .row-padding {
            padding-left: 40px;
          }

          .w-28 {
            width: 28%;
          }

          .w-18 {
            width: 18%;
          }

          .title {
            font-weight: bold;
            margin-top: 47px;
            margin-bottom: 9px;
          }

          .subtitle {
            margin-bottom: 36px;
          }

          .title-row {
            color: #8293a4;
            font-size: 12px;
            margin-bottom: 18px;
            padding-right: 30px;
          }

          .content-row {
            color: black;
            font-size: 14px;
            padding-top: 9px;
            padding-bottom: 10px;
            padding-right: 30px;
          }

          .content-row.selected {
            background-color: #faf6d9;
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

          @media (max-width: 799px) {
            .title {
              margin-top: 22px;
              margin-bottom: 6px;
            }

            .subtitle {
              margin-bottom: 20px;
            }

            .title-row {
              padding-right: 20px;
            }

            .row-padding {
              padding-left: 20px;
            }
          }
        `}</style>
      </>
    )
  )
}

export default ContractsTable
