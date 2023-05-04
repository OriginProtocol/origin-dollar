import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import AccountStore from 'stores/AccountStore'
import {
  formatCurrency,
  formatCurrencyMinMaxDecimals,
  truncateDecimals,
  checkValidInputForCoin,
  removeCommas,
} from 'utils/math'
import { assetRootPath } from 'utils/image'

const CoinImage = ({ small, coin }) => {
  const className = `coin-image`
  return (
    <div className="d-flex align-items-center">
      {coin !== 'mix' && (
        <img
          className={`${className} ${small ? 'small' : ''}`}
          src={assetRootPath(`/images/currency/${coin}-icon-small.svg`)}
        />
      )}
      {coin === 'mix' && (
        <div className="d-flex align-items-start">
          <img
            className={`${className} mixed coin-1 ${small ? 'small' : ''}`}
            src={assetRootPath(`/images/currency/frxeth-icon-small.svg`)}
          />
          <img
            className={`${className} mixed coin-2 ${small ? 'small' : ''}`}
            src={assetRootPath(`/images/currency/reth-icon-small.svg`)}
          />
          <img
            className={`${className} mixed coin-3 ${small ? 'small' : ''}`}
            src={assetRootPath(`/images/currency/steth-icon-small.svg`)}
          />
          <img
            className={`${className} mixed coin-4 ${small ? 'small' : ''}`}
            src={assetRootPath(`/images/currency/weth-icon-small.svg`)}
          />
        </div>
      )}
      <style jsx>{`
        .coin-image {
          width: 40px;
          height: 40px;
        }

        .coin-image.small {
          width: 24px;
          height: 24px;
        }

        .mixed {
          position: relative;
        }

        .coin-1 {
          z-index: 1;
        }

        .coin-2 {
          z-index: 2;
          margin-left: -16px;
        }

        .coin-3 {
          z-index: 3;
          margin-left: -16px;
        }

        .coin-4 {
          z-index: 4;
          margin-left: -16px;
        }
      `}</style>
    </div>
  )
}

const coinToName = {
  eth: 'ETH',
  oeth: 'Origin Ether',
  weth: 'Wrapped Ether',
  reth: 'Rocket Pool ETH',
  steth: 'Liquid Staked Ether 2.0',
  frxeth: 'Frax Ether',
  woeth: 'Wrapped Origin Ether',
  sfrxeth: 'Staked Frax Ether',
  mix: 'Redeem Mix',
}

const TokenSelectionModal = ({
  tokens,
  onClose,
  onSelect,
  conversion,
  coinBalances,
}) => {
  return (
    <>
      <div className="token-selection-modal">
        <div className="content-backdrop" onClick={onClose} />
        <div className="content-container">
          {tokens.map((token) => {
            return (
              <button
                key={token}
                className={`${
                  token === 'oeth' ? 'oeth' : ''
                }  d-flex justify-content-between align-items-center selectable`}
                onClick={() => {
                  onSelect(token)
                  onClose()
                }}
              >
                <div className="coin-view">
                  <CoinImage coin={token} />
                  <div className="coin-breakdown">
                    <span className="name">{coinToName[token]}</span>
                    <span
                      className={`coin ${
                        token === 'mix' ? 'text-capitalize' : 'text-uppercase'
                      } mr-auto`}
                    >
                      {token === 'mix' ? 'frxEth, rETH, stETH, wETH' : token}
                    </span>
                  </div>
                </div>
                <div className="balances">
                  <span className="eth">
                    {coinBalances?.[token]
                      ? parseFloat(coinBalances[token])
                      : 0}
                  </span>
                  <span className="usd">
                    $
                    {formatCurrency(
                      parseFloat(coinBalances?.[token]) * conversion,
                      2
                    )}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <style jsx>{`
        .token-selection-modal {
          position: fixed;
          top: 0;
          left: 0;
          margin: 0 !important;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          align-items: center;
          justify-content: center;
        }

        --bg-opacity: 0.9;

        .token-selection-modal .content-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background-color: rgb(16 17 19 / var(--bg-opacity));
        }

        .token-selection-modal .content-container {
          display: flex;
          flex-direction: column;
          margin: 0 auto;
          max-height: 60vh;
          width: 90vw;
          max-width: 600px;
          z-index: 2;
          background-color: #1e1f25;
          border-radius: 12px;
          padding: 16px;
          overflow: auto;
          color: #fafbfb;
        }

        .token-selection-modal .coin-view {
          display: flex;
          flex-direction: row;
          align-items: center;
        }

        .token-selection-modal .coin-breakdown {
          display: flex;
          flex-direction: column;
          margin-left: 12px;
        }

        .coin-breakdown .name {
          display: flex;
          flex-direction: column;
          font-size: 16px;
          font-weight: 500;
          color: #fafbfb;
          text-align: left;
        }

        .token-selection-modal .coin-breakdown .coin {
          display: flex;
          flex-direction: column;
          color: #828699;
          font-size: 12px;
          font-weight: 400;
          text-align: left;
        }

        .token-selection-modal .coin .usd {
          color: #828699;
        }

        .token-selection-modal .balances {
          display: flex;
          flex-direction: column;
          color: #fafbfb;
          font-size: 16px;
          font-weight: 500;
          text-align: right;
        }

        .balances .usd {
          color: #828699;
          font-size: 12px;
          font-weight: 400;
        }

        .selectable {
          border: none;
          padding: 8px 6px;
          background-color: transparent;
          border-radius: 8px;
        }

        .selectable:hover {
          background-color: #141519;
        }
      `}</style>
    </>
  )
}

const CoinSelect = ({
  selected,
  onChange,
  options = [],
  conversion,
  coinBalances,
}) => {
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
            padding: 8px;
            font-size: 18px;
          }

          .coin {
            color: #fafbfb;
            margin-left: 12px;
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      {open && (
        <TokenSelectionModal
          tokens={options}
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            onChange(option)
            setOpen(false)
          }}
          conversion={conversion}
          coinBalances={coinBalances}
        />
      )}
      <button
        className={`coin-select d-flex align-items-center justify-content-start`}
        onClick={(e) => {
          e.preventDefault()
          setOpen(!open)
        }}
      >
        <CoinImage coin={selected} />
        <div
          className={`coin ${
            selected === 'mix' ? 'text-capitalize' : 'text-uppercase'
          } mr-auto`}
        >
          {selected}
        </div>
        <img
          className="coin-select-icon"
          src={assetRootPath('/images/downcaret.png')}
          alt="Coin select arrow"
        />
      </button>
      <style jsx>{`
        .coin-select {
          min-width: 160px;
          min-height: 40px;
          padding: 8px;
          border-radius: 30px;
          border: solid 1px #141519;
          color: #fafbfb;
          background-color: rgba(255, 255, 255, 0.1);
          cursor: pointer;
        }

        .coin-select:hover {
          background-color: rgba(255, 255, 255, 0.25);
        }

        .coin-select-icon {
          height: 8px;
          width: 12px;
          margin-right: 12px;
        }

        .p-5px {
          padding: 5px;
        }

        .single-coin {
          width: 26px;
          height: 26px;
        }

        .cursor-pointer {
          cursor: pointer;
        }

        .coin {
          color: #fafbfb;
          margin-left: 12px;
        }

        @media (max-width: 799px) {
          .coin-select {
            min-width: 120px;
            min-height: 32px;
            padding: 6px;
          }

          .coin {
            color: #fafbfb;
            margin-left: 8px;
          }
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
  onAmountChange,
  selectedCoin,
  selectedSwap,
  swapsLoading,
  priceToleranceValue,
  swapMode,
  onErrorChange,
  coinValue,
  ethPrice,
}) => {
  const coinBalances = useStoreState(AccountStore, (s) => s.balances)
  const [error, setError] = useState(null)
  const coinMintOptions = [
    'oeth',
    'weth',
    'frxeth',
    'reth',
    'steth',
    'eth',
    'sfrxeth',
  ]
  const coinRedeemOptions = ['oeth', 'mix', 'weth', 'frxeth', 'reth', 'steth']
  const { active } = useWeb3React()

  const bottomItem = !topItem
  const showOeth =
    (swapMode === 'redeem' && topItem) || (swapMode === 'mint' && bottomItem)

  const floorTo2to18Decimals = (value) => {
    return formatCurrencyMinMaxDecimals(value, {
      minDecimals: 2,
      maxDecimals: 18,
      truncate: true,
    })
  }

  const getDisplayBalance = () => {
    const roundDecimals = (value) => {
      return formatCurrencyMinMaxDecimals(parseFloat(value), {
        minDecimals: 2,
        maxDecimals: 8,
        truncate: true,
      })
    }
    if (!active || selectedCoin === 'mix') {
      return null
    } else if (showOeth) {
      return {
        coin: 'oeth',
        balance: roundDecimals(coinBalances.oeth),
        detailedBalance: coinBalances.oeth || 0,
      }
    } else {
      return {
        coin: selectedCoin,
        balance: roundDecimals(coinBalances[selectedCoin]),
        detailedBalance: coinBalances[selectedCoin] || 0,
      }
    }
  }

  const getSelectOptions = () => {
    if (showOeth) {
      return []
    } else {
      if (topItem) {
        return coinMintOptions
      } else {
        return coinRedeemOptions
      }
    }
  }

  useEffect(() => {
    if (onErrorChange) {
      onErrorChange(error)
    }
  }, [error])

  useEffect(() => {
    checkForBalanceError()
  }, [coinValue, swapMode, selectedCoin])

  const displayBalance = getDisplayBalance()

  useEffect(() => {
    /* User has manually inputted the amount that matches the wallet's balance up to 6th decimal.
     * Add the dust (decimals beyond the 6th one) to the input amount so it is not left behind
     * in the wallet.
     */
    if (
      displayBalance &&
      coinValue &&
      floorTo2to18Decimals(displayBalance.detailedBalance) ===
        floorTo2to18Decimals(coinValue) &&
      removeCommas(displayBalance.detailedBalance) !==
        removeCommas(coinValue) &&
      // this bit is required so that zeroes can be added to input when already at max value
      parseFloat(displayBalance.detailedBalance) !== parseFloat(coinValue)
    ) {
      setMaxBalance()
    }
  }, [coinValue, displayBalance])

  const checkForBalanceError = () => {
    if (bottomItem) {
      return
    }

    const coin = swapMode === 'mint' ? selectedCoin : 'oeth'

    setError(parseFloat(coinBalances[coin]) < parseFloat(coinValue))
  }

  const coinsSelectOptions = getSelectOptions()
  const expectedAmount =
    bottomItem && selectedSwap && selectedSwap.amountReceived

  const minReceived =
    bottomItem &&
    selectedSwap &&
    selectedSwap.amountReceived &&
    priceToleranceValue
      ? selectedSwap.amountReceived -
        (selectedSwap.amountReceived * priceToleranceValue) / 100
      : null

  const coinSplits = bottomItem && selectedSwap && selectedSwap.coinSplits

  const maxBalanceSet =
    topItem &&
    displayBalance &&
    // if balance and input match up to 6th decimal. Consider it effectively as set to max balance
    floorTo2to18Decimals(displayBalance.detailedBalance) ===
      floorTo2to18Decimals(coinValue)

  const balanceClickable =
    topItem &&
    displayBalance &&
    !maxBalanceSet &&
    parseFloat(displayBalance.balance) > 0

  const setMaxBalance = () => {
    if (!displayBalance) {
      return
    }

    const valueNoCommas = removeCommas(displayBalance.detailedBalance)
    onAmountChange(valueNoCommas)
  }

  return (
    <>
      <div
        className={`currency-pill d-flex flex-column ${
          topItem ? 'topItem' : ''
        }`}
      >
        <div
          className={`d-flex align-items-start justify-content-between currency-pill-inner`}
        >
          <div
            className={`d-flex flex-column justify-content-between input-holder w-full relative`}
          >
            {topItem && (
              <input
                type="text"
                value={truncateDecimals(coinValue, 18)}
                placeholder="0.00"
                onChange={(e) => {
                  // truncate decimals after 6th position
                  const value = truncateDecimals(e.target.value, 18)
                  const valueNoCommas = removeCommas(value)
                  if (checkValidInputForCoin(valueNoCommas, selectedCoin)) {
                    onAmountChange(valueNoCommas)
                  }
                }}
              />
            )}
            {bottomItem && (
              <div className="expected-value">
                <p className="">
                  {expectedAmount ||
                    (swapsLoading
                      ? fbt('Loading...', 'Swaps Loading...')
                      : '-')}
                </p>
              </div>
            )}
            <div className="usd-balance mt-auto">
              {bottomItem
                ? `$${formatCurrency(
                    truncateDecimals(expectedAmount, 18) * parseFloat(ethPrice),
                    2
                  )}`
                : `$${formatCurrency(
                    truncateDecimals(coinValue, 18) * parseFloat(ethPrice),
                    2
                  )}`}
            </div>
          </div>
          <div className="d-flex flex-column justify-content-between align-items-start">
            <div className="d-flex align-items-center">
              <div
                className={`d-flex justify-content-between balance mb-2 mr-2 ${
                  balanceClickable ? 'clickable' : ''
                }`}
                onClick={setMaxBalance}
              >
                {displayBalance && (
                  <div>
                    {fbt(
                      'Balance: ' +
                        fbt.param('coin-balance', displayBalance.balance),
                      'Coin balance'
                    )}
                    <span className="text-uppercase ml-1">
                      {displayBalance.coin}
                    </span>
                  </div>
                )}
                {balanceClickable && (
                  <a className="max-link ml-2" onClick={setMaxBalance}>
                    {fbt('Max', 'Set maximum currency amount')}
                  </a>
                )}
              </div>
            </div>
            <CoinSelect
              selected={showOeth ? 'oeth' : selectedCoin}
              onChange={(coin) => {
                onSelectChange(coin)
              }}
              options={coinsSelectOptions}
              conversion={ethPrice}
              coinBalances={coinBalances}
            />
            {bottomItem && (
              <div className="balance mt-auto">
                {minReceived !== null
                  ? fbt(
                      'Min. received: ' +
                        fbt.param(
                          'oeth-amount',
                          formatCurrency(minReceived, 2)
                        ) +
                        ' OETH',
                      'Min OETH amount received'
                    )
                  : topItem
                  ? ''
                  : '-'}
              </div>
            )}
          </div>
        </div>
        {coinSplits && (
          <div className="d-flex flex-column multiple-balance-holder">
            {coinSplits.map((split) => {
              return (
                <div
                  className="d-flex justify-content-between align-items-center balance multiple-balance"
                  key={split.coin}
                >
                  <div className="d-flex justify-content-start align-items-center">
                    <CoinImage small coin={split.coin} />
                    <div className="text-uppercase ml-5px">{split.coin}</div>
                  </div>
                  <div>
                    {formatCurrencyMinMaxDecimals(split.amount, {
                      minDecimals: 2,
                      maxDecimals: 18,
                      truncate: true,
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style jsx>{`
        .currency-pill {
          display: flex;
          justify-content: center;
          padding: 42px 20px 42px 40px;
          background-color: #1e1f25;
        }

        .topItem {
          background-color: #18191c;
          border-bottom: solid 1px #141519;
        }

        .currency-pill-inner {
        }

        .balance {
          font-size: 12px;
          color: #828699;
          margin-left: 4px;
        }

        .usd-balance {
          font-size: 16px;
          color: #828699;
          margin-left: 4px;
        }

        .multiple-balance {
          margin-top: 6px;
        }

        .multiple-balance-holder {
          border-top: 1px solid #141519;
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
          max-width: 100%;
          text-align: left;
          font-size: 32px;
          color: #fafbfb;
          background-color: transparent;
        }

        .expected-value {
          font-size: 32px;
          max-width: 100%;
          text-overflow: ellipsis;
          color: #828699;
        }

        .expected-value p {
          white-space: nowrap;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
          overflow: hidden;
        }

        .ml-5px {
          margin-left: 5px;
        }

        .max-link:hover,
        .clickable:hover {
          text-decoration: underline;
        }

        .clickable {
          cursor: pointer;
        }

        .max-link {
          font-size: 12px;
          color: #828699;
          weight: bold;
          cursor: pointer;
        }

        .input-holder {
          width: 100%;
          max-width: 70%;
        }

        @media (max-width: 799px) {
          .input-holder {
            max-width: 50%;
          }

          input {
            font-size: 24px;
          }

          .expected-value {
            font-size: 24px;
          }

          .balance {
            font-size: 12px;
            margin-left: 4px;
            white-space: nowrap;
          }

          .max-link {
            font-size: 10px;
          }
        }
      `}</style>
    </>
  )
}

export default SwapCurrencyPill
