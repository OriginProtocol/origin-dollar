import React, { useState } from 'react'
import classnames from 'classnames'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import Dropdown from 'components/Dropdown'
import { formatCurrency, formatCurrencyAbbreviated } from 'utils/math'
import { assetRootPath } from 'utils/image'

const OusdDropdown = ({}) => {
  const [open, setOpen] = useState(false)
  const ousdBalance = Number(
    useStoreState(AccountStore, (s) => s.balances.ousd)
  )

  return (
    <>
      <Dropdown
        content={
          <div className="dropdown-menu show wrapper">
            <div className="balance-holder d-flex flex-column align-items-center justify-content-center">
              <img
                className="ousd-icon"
                src={assetRootPath('/images/ousd-token-icon.svg')}
              />
              <h1 className="balance">{formatCurrency(ousdBalance, 2)}</h1>
            </div>
            <div className="stats-holder">
              {/*
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">{fbt('Price', 'Price')}</div>
                  <div className="value">$1</div>
                </div>
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">
                    {fbt('Circulating Supply', 'Circulating Supply')}
                  </div>
                  <div className="value">$1</div>
                </div>
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">{fbt('Market Cap', 'Market Cap')}</div>
                  <div className="value">$1</div>
                </div>
              */}
              <a
                className="btn-dark"
                href="http://analytics.ousd.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {fbt('Visit OUSD Dashboard', 'Visit OUSD Dashboard')}
              </a>
            </div>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <div
          className={classnames('ousd-pill', { open })}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          <a
            href="#"
            children={
              <div
                className={`d-flex align-items-center justify-content-center ${
                  open ? 'open' : ''
                }`}
              >
                {formatCurrencyAbbreviated(ousdBalance, 2)} OUSD
              </div>
            }
          />
        </div>
      </Dropdown>
      <style jsx>{`
        .ousd-pill {
          padding: 6px 9px;
          white-space: nowrap;
          min-width: 96px;
          border-radius: 15px;
          border: solid 1px #bbc9da;
          height: 30px;
          margin-right: 10px;
          color: white;
        }

        .ousd-pill.open {
          color: #183140;
          background-color: white;
        }

        .wrapper {
          right: -115px;
          min-width: 360px;
          width: 360px;
          background-color: #183140;
          color: white;
          border: 0;
          padding: 0px;
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.2);
        }

        .ousd-icon {
          width: 60px;
          height: 60px;
          margin-bottom: 14px;
        }

        .balance-holder {
          min-height: 200px;
          background-image: url(/images/earn-coin-waves-grey.svg);
          background-repeat: no-repeat;
          background-position: center top;
          background-size: contain;
        }

        .balance-holder h1 {
          font-size: 46px;
          color: white;
        }

        .stats-holder {
          background-color: #12242f;
          padding: 30px;
          border-radius: 0px 0px 10px 10px;
        }

        .stat-item {
          margin-bottom: 13px;
        }

        .stat {
          font-size: 14px;
        }

        .value {
          font-size: 14px;
          font-weight: bold;
        }

        .btn-dark {
          color: white;
          font-size: 12px;
          height: 30px;
          width: 100%;
          // margin-top: 30px;
        }

        .btn-dark:hover {
          background-color: #0c181f;
        }
      `}</style>
    </>
  )
}

export default OusdDropdown
