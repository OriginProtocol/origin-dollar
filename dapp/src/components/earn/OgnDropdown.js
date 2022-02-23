import React, { useState } from 'react'
import classnames from 'classnames'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import Dropdown from 'components/Dropdown'
import { formatCurrency, formatCurrencyAbbreviated } from 'utils/math'
import CoinStore from 'stores/CoinStore'
import { assetRootPath } from 'utils/image'

const OgnDropdown = ({}) => {
  const [open, setOpen] = useState(false)
  const ognBalance = Number(useStoreState(AccountStore, (s) => s.balances.ogn))
  const { price, circulating_supply, market_cap } = useStoreState(
    CoinStore,
    (s) => s.ogn
  )

  return (
    <>
      {ognBalance > 0 && (
        <Dropdown
          content={
            <div className="dropdown-menu show wrapper">
              <div className="balance-holder d-flex flex-column align-items-center justify-content-center">
                <img
                  className="ogn-icon"
                  src={assetRootPath('/images/ogn-icon-blue.svg')}
                />
                <h1 className="balance">{formatCurrency(ognBalance, 2)}</h1>
              </div>
              {/* <div className="stats-holder pt-0"> */}
              {/* <div className="divider d-flex align-items-center justify-content-center"> */}
              {/*   <div className="up-box"></div> */}
              {/* </div> */}
              {/* <div className="stat-item d-flex justify-content-between mb-0"> */}
              {/*   <div className="stat"> */}
              {/*     {fbt('Wallet Balance', 'Wallet Balance')} */}
              {/*   </div> */}
              {/*   <div className="value">$1</div> */}
              {/* </div> */}

              {/* <div className="stat-item d-flex justify-content-between"> */}
              {/*   <div className="stat"> */}
              {/*     {fbt('Unclaimed Balance', 'Unclaimed Balance')} */}
              {/*   </div> */}
              {/*   <div className="value">$1</div> */}
              {/* </div> */}
              {/* <button */}
              {/*   className="btn-blue darker" */}
              {/*   onClick={async (e) => { */}
              {/*     alert('Implement me please') */}
              {/*   }} */}
              {/* > */}
              {/*   {fbt('Claim OGN', 'Claim OGN')} */}
              {/* </button> */}
              {/* </div> */}
              <div className="stats-holder darker">
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">{fbt('Price', 'Price')}</div>
                  <div className="value">${formatCurrency(price, 6)}</div>
                </div>
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">
                    {fbt('Circulating Supply', 'Circulating Supply')}
                  </div>
                  <div className="value">
                    {formatCurrency(circulating_supply, 0) + ' OGN'}
                  </div>
                </div>
                <div className="stat-item d-flex justify-content-between">
                  <div className="stat">{fbt('Market Cap', 'Market Cap')}</div>
                  <div className="value">${formatCurrency(market_cap, 0)}</div>
                </div>
                <a
                  className="btn-blue"
                  href="https://www.originprotocol.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {fbt('Visit OGN Dashboard', 'Visit OGN Dashboard')}
                </a>
              </div>
            </div>
          }
          open={open}
          onClose={() => setOpen(false)}
        >
          <div
            className={classnames('ogn-pill', { open })}
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
                  {formatCurrencyAbbreviated(ognBalance, 2)} OGN
                </div>
              }
            />
          </div>
        </Dropdown>
      )}
      <style jsx>{`
        .ogn-pill {
          padding: 6px 9px;
          white-space: nowrap;
          min-width: 96px;
          border-radius: 15px;
          border: 0px;
          background-color: #1a82ff;
          height: 30px;
          margin-right: 10px;
          color: white;
        }

        .ogn-pill.open {
          color: #183140;
          background-color: white;
        }

        .wrapper {
          right: -115px;
          min-width: 360px;
          width: 360px;
          background-color: #1a82ff;
          color: white;
          border: 0;
          padding: 0px;
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.2);
        }

        .ogn-icon {
          width: 60px;
          height: 60px;
          margin-bottom: 14px;
          margin-top: 37px;
          border-radius: 30px;
          box-shadow: 0 0 14px 0 rgba(255, 255, 255, 0.3);
        }

        .balance-holder {
          background-color: #1a82ff;
          margin-bottom: 8px;
          border-radius: 10px 10px 0px 0px;
        }

        .balance-holder h1 {
          font-size: 46px;
          color: white;
          margin-bottom: 24px;
        }

        .stats-holder {
          background-color: #1a82ff;
          padding: 30px;
          border-radius: 0px 0px 10px 10px;
        }

        .stats-holder.darker {
          background-color: #107afa;
        }

        .stats-holder .divider {
          width: 100%;
          border-top: solid 0.3px #fefefe;
          margin-bottom: 20px;
          margin-top: 0px;
          opacity: 0.4;
          position: relative;
        }

        .stats-holder .divider .up-box {
          height: 8px;
          width: 8px;
          border: solid 0.3px #fefefe;
          transform: rotate(45deg);
          top: -5px;
          position: absolute;
          border-bottom: 0px;
          border-right: 0px;
          background-color: #1a82ff;
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

        .btn-blue {
          color: white;
          font-size: 12px;
          height: 30px;
          width: 100%;
          margin-top: 30px;
        }

        .btn-blue.darker {
          background-color: #107afa;
        }
      `}</style>
    </>
  )
}

export default OgnDropdown
