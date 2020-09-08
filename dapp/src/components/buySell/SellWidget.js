import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { formatCurrency } from 'utils/math.js'
import CoinWithdrawBox from 'components/buySell/CoinWithdrawBox'
import ContractStore from 'stores/ContractStore'
import { AccountStore } from 'stores/AccountStore'
import TimelockedButton from 'components/TimelockedButton'

const SellWidget = ({
  ousdToSell,
  setOusdToSell,
  displayedOusdToSell,
  setDisplayedOusdToSell,
  sellFormErrors,
  setSellFormErrors,
  selectedSellCoin,
  setSelectedSellCoin,
}) => {
  const sellFormHasErrors = Object.values(sellFormErrors).length > 0
  const ousdToSellNumber = parseFloat(ousdToSell) || 0

  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const ousdExchangeRates = useStoreState(
    AccountStore,
    (s) => s.ousdExchangeRates
  )
  const {
    vault: vaultContract,
    usdt: usdtContract,
    dai: daiContract,
    usdc: usdcContract,
    ousd: ousdContract,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  useEffect(() => {
    const newFormErrors = {}
    if (ousdToSell > parseFloat(ousdBalance)) {
      newFormErrors.ousd = 'not_have_enough'
    }

    setSellFormErrors(newFormErrors)
  }, [ousdToSell])

  const onSellNow = async (e) => {
    let contractAddress
    if (selectedSellCoin === 'dai') {
      contractAddress = daiContract.address
    } else if (selectedSellCoin === 'usdt') {
      contractAddress = usdtContract.address
    } else if (selectedSellCoin === 'usdc') {
      contractAddress = usdcContract.address
    }

    try {
      const result = await vaultContract.redeem(
        contractAddress,
        ethers.utils.parseUnits(
          ousdToSell.toString(),
          await ousdContract.decimals()
        )
      )

      storeTransaction(result, `redeem`, selectedSellCoin)
    } catch (e) {
      storeTransactionError(`redeem`, selectedSellCoin)
      console.error('Error selling OUSD: ', e)
    }
  }

  console.log('OUSD TO SELL: ', ousdToSellNumber)
  return (
    <>
      <div className="sell-table">
        <div className="header d-flex">
          <div>{fbt('Asset', 'Asset')}</div>
          <div className="ml-auto text-right pr-3">
            {fbt('Remaining Balance', 'Remaining Balance')}
          </div>
        </div>
        <div
          className={`ousd-estimation d-flex align-items-center justify-content-start ${
            Object.values(sellFormErrors).length > 0 ? 'error' : ''
          }`}
        >
          <img
            className="ml-2"
            src="/images/currency/ousd-token.svg"
            alt="OUSD token icon"
          />
          <input
            type="float"
            className="ml-4"
            placeholder="0.00"
            value={displayedOusdToSell}
            onChange={(e) => {
              const value =
                parseFloat(e.target.value) < 0 ? '0' : e.target.value
              const valueNoCommas = value.replace(',', '')
              setOusdToSell(valueNoCommas)
              setDisplayedOusdToSell(value)
            }}
            onBlur={(e) => {
              setDisplayedOusdToSell(formatCurrency(ousdToSell))
            }}
            onFocus={(e) => {
              if (!ousdToSell) {
                setDisplayedOusdToSell('')
              }
            }}
          />
          <div className="balance ml-auto">
            {formatCurrency(Math.max(0, ousdBalance - ousdToSell))} OUSD
          </div>
        </div>
        <div className="horizontal-break" />
        {ousdToSellNumber === 0 && (
          <div className="withdraw-no-ousd-banner d-flex flex-column justify-content-center align-items-center">
            <div className="title">
              {fbt('Enter OUSD amount to sell', 'Enter Ousd to sell')}
            </div>
            <div>
              {fbt(
                'We will show you a preview of the stablecoins you will receive in exchange. Amount generated will include an exit fee of 0.5%',
                'Enter Ousd to sell text'
              )}
            </div>
          </div>
        )}
        {ousdToSellNumber > 0 && (
          <div className="withdraw-section d-flex justify-content-center">
            <CoinWithdrawBox
              active={selectedSellCoin === 'usdt'}
              onClick={(e) => {
                e.preventDefault()
                setSelectedSellCoin('usdt')
              }}
              coin="usdt"
              exchangeRate={ousdExchangeRates['usdt']}
              ousdAmount={ousdToSell}
            />
            <CoinWithdrawBox
              active={selectedSellCoin === 'dai'}
              onClick={(e) => {
                e.preventDefault()
                setSelectedSellCoin('dai')
              }}
              coin="dai"
              exchangeRate={ousdExchangeRates['dai']}
              ousdAmount={ousdToSell}
            />
            <CoinWithdrawBox
              active={selectedSellCoin === 'usdc'}
              onClick={(e) => {
                e.preventDefault()
                setSelectedSellCoin('usdc')
              }}
              coin="usdc"
              exchangeRate={ousdExchangeRates['usdc']}
              ousdAmount={ousdToSell}
            />
          </div>
        )}
        <div className="actions d-flex flex-md-row flex-column justify-content-center justify-content-md-between">
          <div>
            {Object.values(sellFormErrors).length > 0 && (
              <div className="error-box d-flex align-items-center justify-content-center">
                {fbt(
                  'You don’t have enough ' +
                    fbt.param(
                      'coins',
                      Object.keys(sellFormErrors).join(', ').toUpperCase()
                    ),
                  'You dont have enough stablecoins'
                )}
              </div>
            )}
          </div>
          <TimelockedButton
            disabled={sellFormHasErrors || !ousdToSell}
            className="btn-blue"
            onClick={onSellNow}
            text={fbt('Sell now', 'Sell now')}
          />
        </div>
      </div>
      <style jsx>{`
        .sell-table .ousd-estimation {
          padding: 14px;
          width: 100%;
        }

        .sell-table .header {
          margin-top: 18px;
        }

        .withdraw-no-ousd-banner {
          font-size: 12px;
          line-height: 1.42;
          text-align: center;
          color: #8293a4;
          min-height: 170px;
          height: 170px;
          border-radius: 5px;
          background-color: #f2f3f5;
          margin-bottom: 31px;
        }

        .withdraw-no-ousd-banner .title {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: 9px;
        }

        .sell-table .ousd-estimation input {
          width: 140px;
          height: 40px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          font-size: 18px;
          color: black;
          padding: 8px 15px;
          text-align: right;
        }

        .sell-table .ousd-estimation input:focus {
          outline: none;
        }

        .sell-table .ousd-estimation.error input {
          border: solid 1px #ed2a28;
        }

        .withdraw-section {
          margin-left: -10px;
          margin-right: -10px;
          margin-bottom: 28px;
        }

        .ousd-estimation {
          width: 350px;
          height: 50px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          padding: 0;
        }

        .ousd-estimation .value {
          font-size: 18px;
          color: black;
          padding: 14px;
        }

        .ousd-estimation .balance {
          font-size: 12px;
          color: #8293a4;
        }

        .header {
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
          margin-top: 18px;
          margin-bottom: 9px;
        }

        .header > :first-of-type {
          width: 190px;
        }

        .header > :last-of-type {
          margin-left: 10px;
          width: 350px;
        }

        .horizontal-break {
          width: 100%;
          height: 1px;
          background-color: #dde5ec;
          margin-top: 20px;
          margin-bottom: 20px;
        }

        .error-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          background-color: #fff0f0;
          height: 50px;
          min-width: 320px;
        }

        .warning-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #eaad00;
          background-color: #fff0c4;
          height: 50px;
          min-width: 320px;
        }

        @media (max-width: 799px) {
          .withdraw-section {
            margin-left: -20px;
            margin-right: -20px;
            justify-content: space-between;
            margin-bottom: 33px;
          }

          .withdraw-no-ousd-banner {
            min-height: 159px;
            height: 159px;
          }
        }
      `}</style>
    </>
  )
}

export default SellWidget
