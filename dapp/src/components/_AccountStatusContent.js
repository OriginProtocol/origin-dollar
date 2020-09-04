import React from 'react'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { get } from 'lodash'

import { AccountStore } from 'stores/AccountStore'
import { isCorrectNetwork, truncateAddress, networkIdToName } from 'utils/web3'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'

const AccountStatusContent = ({ className, onOpen }) => {
  const web3react = useWeb3React()
  const { deactivate, active, account, chainId } = web3react
  const correctNetwork = isCorrectNetwork(web3react)
  const balances = useStoreState(AccountStore, (s) => s.balances)

  return (
    <>
      <div
        className={`${
          className ? className + ' ' : ''
        }account-status-content d-flex flex-column justify-content-center`}
      >
        <div className="drop-container">
          <div className="d-flex align-items-center mb-3">
            {active && !correctNetwork && (
              <>
                <div className="dot big yellow" />
                <h2>{fbt('Incorrect network', 'Incorrect network')}</h2>
              </>
            )}
            {active && correctNetwork && (
              <>
                <div className="dot big green" />
                <h2>
                  {fbt(
                    'Connected to ' +
                      fbt.param('network-name', networkIdToName(chainId)),
                    'connected to'
                  )}
                </h2>
              </>
            )}
          </div>
          {active && correctNetwork && (
            <>
              <hr />
              <div className="d-flex align-items-start">
                {/* TODO: do not hardcode connector image */}
                <img
                  className="connector-image"
                  src="/images/metamask-icon.svg"
                />
                <div className="d-flex flex-column">
                  <div className="address">{truncateAddress(account)}</div>
                  {Object.keys(currencies).map((currency, index) => (
                    <div className={`currency ${index === Object.keys(currencies).length - 1 ? 'last' : ''}`} key={currency}>
                      {formatCurrency(get(balances, currency, 0), 2)} {currency}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {active && correctNetwork && (
          <div className="disconnect-box d-flex">
            <a
              className="btn-clear-blue w-100"
              onClick={(e) => {
                e.preventDefault()
                onOpen(false)
                deactivate()
                localStorage.setItem('eagerConnect', false)
              }}
            >
              {fbt('Disconnect', 'Disconnect')}
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        h2 {
          font-size: 18px;
          color: #183140;
          font-weight: normal;
          margin-bottom: 0px;
        }

        hr {
          height: 1px;
          background-color: #dde5ec;
          width: 100%;
          padding-top: 0px;
          margin-bottom: 12px;
        }

        .connector-image {
          height: 20px;
          margin-right: 12px;
          margin-top: 3px;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 5px;
          background-color: #ed2a28;
          margin-left: 13px;
        }

        .dot.empty {
          margin-left: 0px;
        }

        .dot.green {
          background-color: #00d592;
        }

        .dot.green.yellow {
          background-color: #ffce45;
        }

        .dot.big {
          width: 16px;
          height: 16px;
          border-radius: 8px;
          margin-right: 12px;
        }

        .dot.yellow.big,
        .dot.green.big {
          margin-left: 0px;
        }

        .address {
          font-family: Lato;
          font-size: 18px;
          color: #183140;
          margin-bottom: 10px;
        }

        .currency {
          font-family: Lato;
          font-size: 12px;
          color: #8293a4;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .currency.last {
          margin-bottom: 17px;
        }

        .disconnect-box {
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: #fafbfc;
          margin: 0px -1px -1px -1px;
          padding: 20px;
        }

        .drop-container {
          padding: 0px 20px 0px 20px;
        }

        .account-status-content {
          padding: 16px 0px 0px 0px;
          min-width: 270px;
        }

        @media (max-width: 799px) {
          .account-status-content {
            height: 100%;
          }

          .disconnect-box {
            margin-top: auto;
          }
        }
      `}</style>
    </>
  )
}

export default AccountStatusContent
