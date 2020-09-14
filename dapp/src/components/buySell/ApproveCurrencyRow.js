import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import AccountStore from 'stores/AccountStore'
import withRpcProvider from 'hoc/withRpcProvider'
import ContractStore from 'stores/ContractStore'

import mixpanel from 'utils/mixpanel'

const ApproveCurrencyRow = ({
  coin,
  isLast,
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  onApproved,
}) => {
  //approve, waiting-user, waiting-network, done
  const [stage, setStage] = useState('approve')
  const [contract, setContract] = useState(null)
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const { vault, usdt, dai, usdc } = useStoreState(
    ContractStore,
    (s) => s.contracts || {}
  )

  useEffect(() => {
    if (coin === 'dai') {
      setContract(dai)
    } else if (coin === 'usdt') {
      setContract(usdt)
    } else if (coin === 'usdc') {
      setContract(usdc)
    }
  }, [])

  return (
    <>
      <div
        className={`currency-row d-flex align-items-center ${
          isLast ? 'last' : ''
        }`}
      >
        <img className="icon" src={`/images/currency/${coin}-icon-small.svg`} />
        {stage === 'approve' && (
          <>
            {fbt(
              'Permission to use ' + fbt.param('coin-name', coin.toUpperCase()),
              'permission to use coin'
            )}
            <a
              className="blue-btn d-flex align-items-center justify-content-center"
              onClick={async (e) => {
                mixpanel.track('Approve clicked', {
                  coin,
                })
                setStage('waiting-user')
                try {
                  const maximum = ethers.constants.MaxUint256
                  const result = await contract.approve(vault.address, maximum)
                  storeTransaction(result, 'approve', coin)
                  setStage('waiting-network')

                  const receipt = await rpcProvider.waitForTransaction(
                    result.hash
                  )
                  if (onApproved) {
                    mixpanel.track('Approval succeeded', {
                      coin,
                    })
                    onApproved()
                  }
                  setStage('done')
                } catch (e) {
                  storeTransactionError('approve', coin)
                  console.error('Exception happened: ', e)
                  setStage('approve')
                  mixpanel.track('Approval failed', {
                    coin,
                  })
                }
              }}
            >
              {fbt('Approve', 'Approve')}
            </a>
          </>
        )}
        {stage === 'waiting-user' && (
          <>
            {fbt(
              'Waiting for you to approve...',
              'Waiting for you to approve...'
            )}
            <img
              className="waiting-icon ml-auto"
              src={`/images/${connectorIcon}`}
            />
          </>
        )}
        {stage === 'waiting-network' && (
          <>
            {fbt(
              'Approving ' + fbt.param('coin-name', coin.toUpperCase() + '...'),
              'approving coin'
            )}
            <img
              className="waiting-icon rotating ml-auto"
              src="/images/spinner-green-small.png"
            />
          </>
        )}
        {stage === 'done' && (
          <>
            {fbt(
              fbt.param('coin-name', coin.toUpperCase() + ' approved'),
              'Coin approved'
            )}
            <img
              className="waiting-icon ml-auto"
              src="/images/green-check.svg"
            />
          </>
        )}
      </div>
      <style jsx>{`
        .currency-row {
          padding-top: 13px;
          padding-bottom: 13px;
          border-bottom: 1px solid #dde5ec;
        }

        .currency-row.last {
          border-bottom: 0px;
        }

        .icon {
          margin-right: 10px;
          width: 30px;
          height: 30px;
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
        }

        .blue-btn {
          margin-left: auto;
          height: 35px;
          border-radius: 25px;
          background-color: #1a82ff;
          padding-left: 19px;
          padding-right: 19px;
          color: white;
          cursor: pointer;
        }

        .blue-btn:hover {
          background-color: #0a72ef;
          text-decoration: none;
        }

        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }

        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(ApproveCurrencyRow)
