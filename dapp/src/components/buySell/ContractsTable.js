import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { find, sortBy } from 'lodash'
import { useStoreState } from 'pullstate'
import { formatCurrency } from 'utils/math'

import ContractStore from 'stores/ContractStore'

const ContractsTable = () => {
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)

  const swapContracts = {
    flipper: {
      name: fbt('Origin Swap', 'Contract Table Origin Swap'),
    },
    vault: {
      name: fbt('Origin Vault', 'Contract Table Origin Vault'),
    },
    uniswap: {
      name: fbt('Origin Uniswap', 'Contract Table Uniswap'),
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
    amount_too_high: fbt(
      'Amount too high',
      'Swap estimations: amount too hight'
    ),
  }

  const bestEstimation = find(
    swapEstimations,
    (estimation) => estimation.isBest
  )
  const usedContractName = bestEstimation
    ? swapContracts[bestEstimation.name].name
    : '...'

  const swapEstimatinosReady =
    swapEstimations && typeof swapEstimations === 'object'
  const contractOrder = swapEstimatinosReady
    ? sortBy(Object.values(swapEstimations), (e) => e.effectivePrice).map(
        (e) => e.name
      )
    : Object.keys(swapContracts)
  return (
    <>
      <div className="d-flex flex-column contracts-table">
        <div className="pl-40 title">
          {fbt('Contracts', 'Contracts table title')}
        </div>
        <div className="pl-40 subtitle">
          {fbt(
            'Your transaction will use contract: ' +
              fbt.param('contract used', usedContractName),
            'Info of picked contract for the swap'
          )}
        </div>
      </div>
      <div className="d-flex flex-column">
        <div className="d-flex title-row pl-40">
          <div className="w-28">{fbt('Name', 'Contract Table Name')}</div>
          <div className="w-18">
            {fbt('Est. received', 'Contract Table Est. received')}
          </div>
          <div className="w-18">
            {fbt('Gas estimate', 'Contract Table Gas estimate')}
          </div>
          <div className="w-18">
            {fbt('Effective Price', 'Contract Table Effective Price')}
          </div>
          <div className="w-18">{fbt('Diff', 'Contract Table Diff')}</div>
        </div>
        {contractOrder.map((contract) => {
          const swapContract = swapContracts[contract]
          const loading = swapEstimations === 'loading'
          const empty = swapEstimations === null
          const estimation = swapEstimatinosReady
            ? swapEstimations[contract]
            : null

          const isError = estimation && !estimation.canDoSwap
          const errorReason = isError && estimation.error
          const canDoSwap = estimation && estimation.canDoSwap

          let status
          let redStatus = false
          if (loading) {
            status = fbt('Calculating...', 'Swap estimations: calculating...')
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
          return (
            <div
              className={`d-flex content-row pl-40 ${
                canDoSwap && estimation.isBest ? 'best' : ''
              }`}
              key={swapContract.name}
            >
              <div className="w-28">{swapContract.name}</div>
              <div className="w-18">
                {loadingOrEmpty
                  ? '-'
                  : formatCurrency(estimation.amountReceived, 2)}
              </div>
              <div className="w-18">
                {loadingOrEmpty || !canDoSwap
                  ? '-'
                  : `$${formatCurrency(estimation.gasEstimate, 2)}`}
              </div>
              <div className="w-18">
                {loadingOrEmpty || !canDoSwap
                  ? '-'
                  : `$${formatCurrency(estimation.effectivePrice, 2)}`}
              </div>
              <div className={`w-18 ${redStatus ? 'red' : ''}`}>
                {loadingOrEmpty ? '-' : status}
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

        .pl-40 {
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
        }

        .content-row {
          color: black;
          font-size: 14px;
          padding-top: 9px;
          padding-bottom: 10px;
        }

        .content-row.best {
          background-color: #faf6d9;
        }

        .red {
          color: #ff0000;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default ContractsTable
