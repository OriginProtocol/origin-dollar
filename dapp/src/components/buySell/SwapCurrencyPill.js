import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import Dropdown from 'components/Dropdown'
import { usePrevious } from 'utils/hooks'
import analytics from 'utils/analytics'
import {
  formatCurrency,
  truncateDecimals,
  checkValidInputForCoin,
} from 'utils/math'
import { currencies } from 'constants/Contract'

const DownCaret = ({ color = '#608fcf', size = '30' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20">
    <g stroke={color} strokeWidth="1" strokeLinecap="round">
      <line x1="7" y1="9" x2="10" y2="12" />
      <line x1="10" y1="12" x2="13" y2="9" />
    </g>
  </svg>
)

const CoinImage = ({ small, coin }) => {
  return (
    <div className="d-flex align-items-center">
      {coin !== 'mix' && (
        <img
          className={`coin-image ${small ? 'small' : ''}`}
          src={`/images/currency/${coin}-icon-small.svg`}
        />
      )}
      {coin === 'mix' && (
        <div className="d-flex align-items-start">
          <img
            className={`coin-image mixed coin-1 ${small ? 'small' : ''}`}
            src={`/images/currency/dai-icon-small.svg`}
          />
          <img
            className={`coin-image mixed coin-2 ${small ? 'small' : ''}`}
            src={`/images/currency/usdt-icon-small.svg`}
          />
          <img
            className={`coin-image mixed coin-3 ${small ? 'small' : ''}`}
            src={`/images/currency/usdc-icon-small.svg`}
          />
        </div>
      )}
      <style jsx>{`
        .coin-image {
          width: 26px;
          height: 26px;
        }

        .coin-image.small {
          width: 14px;
          height: 14px;
        }

        .mixed {
          position: relative;
        }

        .coin-1 {
          z-index: 1;
        }

        .coin-2 {
          z-index: 2;
          margin-left: -9px;
        }

        .coin-3 {
          z-index: 3;
          margin-left: -9px;
        }
      `}</style>
    </div>
  )
}

const CoinSelect = ({ selected, onChange, options = [] }) => {
  const [open, setOpen] = useState(false)

  if (options.length === 0) {
    return (
      <>
        <div
          className={`coin-select d-flex align-items-center justify-content-start`}
        >
          <CoinImage coin={selected} />
          <div className="coin text-uppercase mr-auto">{selected}</div>
        </div>
        <style jsx>{`
          .coin-select {
            min-width: 160px;
            min-height: 40px;
            padding: 7px 20px 7px 7px;
            font-size: 18px;
          }

          .coin {
            color: black;
            margin-left: 12px;
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      <Dropdown
        content={
          <div className="dropdown-menu show wrapper d-flex flex-column">
            {options.map((option) => {
              return (
                <div
                  key={option}
                  className="d-flex justify-content-start align-items-center pb-10 cursor-pointer"
                  onClick={(e) => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <CoinImage coin={option} />
                  <div className="coin text-uppercase mr-auto">{option}</div>
                </div>
              )
            })}
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <div
          className={`coin-select d-flex align-items-center justify-content-start`}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          <CoinImage coin={selected} />
          <div className="coin text-uppercase mr-auto">{selected}</div>
          <DownCaret />
        </div>
      </Dropdown>
      <style jsx>{`
        .dropdown-menu {
          padding: 15px 15px 5px 15px;
          right: auto;
          left: 0;
          top: 100%;
        }

        .coin-select {
          min-width: 160px;
          min-height: 40px;
          padding: 7px 20px 7px 7px;
          border-radius: 20px;
          border: solid 1px #cdd7e0;
          background-color: white;
          cursor: pointer;
        }

        .coin-select:hover {
          background-color: #f2f3f5;
        }

        .pb-10 {
          padding-bottom: 10px;
        }

        .single-coin {
          width: 26px;
          height: 26px;
        }

        .cursor-pointer {
          cursor: pointer;
        }

        .coin {
          color: black;
          margin-left: 12px;
        }
      `}</style>
    </>
  )
}

/*
 * selectedCoin - the coin or coin combination to be shown - selected
 * balances - Array of balances to be shown. UI differs when there is only 1 item vs many in the array
 */
const SwapCurrencyPill = ({
  topItem,
  onSelectChange,
  selectedCoin,
  swapMode,
}) => {
  const coinBalances = useStoreState(AccountStore, (s) => s.balances)
  const [coinValue, setCoinValue] = useState(0)
  const stableCoinMintOptions = ['dai', 'usdt', 'usdc']
  const coinRedeemOptions = ['mix', 'dai', 'usdt', 'usdc']

  const showOusd =
    (swapMode === 'redeem' && topItem) || (swapMode === 'mint' && !topItem)

  const getDisplayBalances = () => {
    const balances = []
    if (showOusd) {
      balances.push({
        coin: 'ousd',
        balance: coinBalances.ousd,
      })
    } else {
      if (selectedCoin === 'mix') {
        stableCoinMintOptions.forEach((coin) => {
          balances.push({
            coin,
            balance: coinBalances[coin],
          })
        })
      } else {
        balances.push({
          coin: selectedCoin,
          balance: coinBalances[selectedCoin],
        })
      }
    }

    return balances
  }

  const getSelectOptions = () => {
    if (showOusd) {
      return []
    } else {
      if (topItem) {
        return stableCoinMintOptions
      } else {
        return coinRedeemOptions
      }
    }
  }

  const displayBalances = getDisplayBalances()
  const coinsSelectOptions = getSelectOptions()

  return (
    <>
      <div
        className={`currency-pill d-flex flex-column ${
          topItem ? 'topItem' : ''
        }`}
      >
        <div
          className={`d-flex align-items-start justify-content-between h-100`}
        >
          <div className="d-flex flex-column justify-content-between align-items-start h-100">
            <CoinSelect
              selected={showOusd ? 'ousd' : selectedCoin}
              onChange={onSelectChange}
              options={coinsSelectOptions}
            />
            <div className="d-flex justify-content-between balance mt-20">
              {displayBalances.length === 1 && (
                <div>
                  {fbt(
                    'Balance: ' +
                      fbt.param(
                        'coin-balance',
                        formatCurrency(coinBalances[displayBalances[0].coin], 2)
                      ),
                    'Coin balance'
                  )}
                  <span className="text-uppercase ml-1">
                    {displayBalances[0].coin}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="d-flex flex-column justify-content-between align-items-end">
            {topItem && (
              <input
                type="text"
                value={coinValue}
                onChange={(e) => {
                  const value = truncateDecimals(e.target.value)
                  const valueNoCommas = value.replace(/,/g, '')
                  if (checkValidInputForCoin(valueNoCommas, selectedCoin)) {
                    setCoinValue(valueNoCommas)
                    //setTotal(truncateDecimals(valueNoCommas * exchangeRate))
                    //localStorage[localStorageKey] = valueNoCommas
                  }
                }}
              />
            )}
            {!topItem && <div className="expected-value">123.23</div>}
            {!showOusd && (
              <div className="balance mt-10">
                {fbt(
                  'Min. received: ' +
                    fbt.param('ousd-amount', '90.23') +
                    ' OUSD',
                  'Min OUSD amount received'
                )}
              </div>
            )}
          </div>
        </div>
        {displayBalances.length > 1 && (
          <div className="d-flex flex-column multiple-balance-holder">
            {displayBalances.map((balance) => {
              return (
                <div
                  className="d-flex justify-content-between align-items-center balance multiple-balance"
                  key={balance.coin}
                >
                  <div className="d-flex justify-content-start align-items-center">
                    <CoinImage small coin={balance.coin} />
                    <div className="text-uppercase ml-5px">{balance.coin}</div>
                  </div>
                  <div>{formatCurrency(coinBalances[balance.coin], 2)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style jsx>{`
        .currency-pill {
          min-height: 90px;
          margin-bottom: 10px;
          padding: 10px 23px 14px 10px;
          border: solid 1px #cdd7e0;
          border-radius: 10px;
          background-color: white;
        }

        .currency-pill.topItem {
          background-color: #fafbfc;
        }

        .balance {
          font-size: 12px;
          color: #8293a4;
          margin-left: 4px;
        }

        .multiple-balance {
          margin-top: 6px;
        }

        .multiple-balance-holder {
          border-top: 1px solid #cdd7e0;
          margin-left: -10px;
          margin-right: -24px;
          padding-left: 10px;
          padding-right: 24px;
          margin-top: 10px;
          padding-top: 4px;
        }

        .mt-20 {
          margin-top: 20px;
        }

        .mt-10 {
          margin-top: 10px;
        }

        .coin {
          width: 15px;
          height: 15px;
          margin-right: 5px;
        }

        input {
          border: 0px;
          text-align: right;
          font-size: 24px;
          color: #183140;
          background-color: transparent;
        }

        .expected-value {
          font-size: 24px;
          color: #8293a4;
        }

        .ml-5px {
          margin-left: 5px;
        }
      `}</style>
    </>
  )
}

export default SwapCurrencyPill
