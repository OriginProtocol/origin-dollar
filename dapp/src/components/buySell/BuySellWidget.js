import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import { AccountStore } from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import CoinRow from 'components/buySell/CoinRow'
import CoinWithdrawBox from 'components/buySell/CoinWithdrawBox'
import ApproveModal from 'components/buySell/ApproveModal'
import ApproveCurrencyInProgressModal from 'components/buySell/ApproveCurrencyInProgressModal'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math.js'
import withRpcProvider from 'hoc/withRpcProvider'


const BuySellWidget = ({ storeTransaction }) => {
  const ousdBalance = useStoreState(AccountStore, s => s.balances['ousd'] || 0)
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const [tab, setTab] = useState('buy')
  const [daiOusd, setDaiOusd] = useState(0)
  const [usdtOusd, setUsdtOusd] = useState(0)
  const [usdcOusd, setUsdcOusd] = useState(0)
  const [dai, setDai] = useState(0)
  const [usdt, setUsdt] = useState(0)
  const [usdc, setUsdc] = useState(0)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [currenciesNeedingApproval, setCurrenciesNeedingApproval] = useState([])
  const { Vault, MockUSDT, MockDAI, MockUSDC, OUSD } = useStoreState(ContractStore, s => s.contracts || {})

  const [ousdToSell, setOusdToSell] = useState(0)
  const [selectedSellCoin, setSelectedSellCoin] = useState('usdt')

  const onMintOusd = async () => {
    try {
      if (usdt > 0) {
        const result = await OUSD.mint(
          MockUSDT.address,
          ethers.utils.parseUnits(usdt.toString(), await MockUSDT.decimals())
        )
        // todo convert this into a single transaction
        storeTransaction(result, `mint`, 'usdt')
      }
      if (usdc > 0) {
        const result = await OUSD.mint(
          MockUSDC.address,
          ethers.utils.parseUnits(usdc.toString(), await MockUSDC.decimals())
        )
        storeTransaction(result, `mint`, 'usdc,usdt')
      }
      if (dai > 0) {
        const result = await OUSD.mint(
          MockDAI.address,
          ethers.utils.parseUnits(dai.toString(), await MockDAI.decimals())
        )
        storeTransaction(result, `mint`, 'dai,usdt,usdc')
      }

      clearLocalStorageCoinSettings()
    } catch (e) {
      console.error('Error minting ousd! ', e)
    }
  }

  const clearLocalStorageCoinSettings = () => {
    Object.values(currencies).forEach(c => localStorage.removeItem(c.localStorageSettingKey))
  }

  const onBuyNow = async e => {
    e.preventDefault()
    const needsApproval = []
    //const needsApproval = ['dai', 'usdt', 'usdc']

    const checkForApproval = (name, selectedAmount) => {
      // float conversion is not ideal, but should be good enough for allowance check
      if (selectedAmount > 0 && parseFloat(allowances[name]) < parseFloat(selectedAmount)) {
        needsApproval.push(name)
      }
    }

    checkForApproval('dai', dai)
    checkForApproval('usdt', usdt)
    checkForApproval('usdc', usdc)
    setCurrenciesNeedingApproval(needsApproval)
    if (needsApproval.length > 0) {
      setShowApproveModal(true)
    } else {
      await onMintOusd()
    }
  }

  const onSellNow = async e => {
    let contractAddress
    if (selectedSellCoin === 'dai') {
      contractAddress = MockDAI.address
    } else if (selectedSellCoin === 'usdt') {
      contractAddress = MockUSDT.address
    } else if (selectedSellCoin === 'usdc') {
      contractAddress = MockUSDC.address
    }

    try {
      const result = await OUSD.redeem(
        MockDAI.address,
        ethers.utils.parseUnits(ousdToSell.toString(), await OUSD.decimals())
      )

      storeTransaction(result, `redeem`, selectedSellCoin)
    } catch (e) {
      console.error("Error selling OUSD: ", e)
    }
  }

  return <>
    <div className="buy-sell-widget d-flex flex-column">
      {/* If approve modal is not shown and transactions are pending show
          the pending approval transactions modal */}
      {!showApproveModal && <ApproveCurrencyInProgressModal />}
      {showApproveModal && <ApproveModal
        currenciesNeedingApproval={currenciesNeedingApproval}
        onClose={ e => {
          e.preventDefault()
          setShowApproveModal(false)
        }}
        onFinalize={ async () => {
          await onMintOusd()
          setShowApproveModal(false)
        }}
      />}
      <div className="tab-navigation">
        <a
          onClick={e => {
            e.preventDefault()
            setTab('buy')
          }}
          className={`${tab === 'buy' ? 'active' : ''}`}
        >
          {fbt('Buy OUSD', 'Buy OUSD')}
        </a>
        <a
          onClick={e => {
            e.preventDefault()
            setTab('sell')
          }}
          className={`${tab === 'sell' ? 'active' : ''}`}
        >
          {fbt('Sell OUSD', 'Sell OUSD')}
        </a>
      </div>
      {tab === 'buy' && <div className="coin-table">
        <div className="header d-flex">
          <div>{fbt('Asset', 'Asset')}</div>
          <div className="ml-auto">{fbt('Exchange Rate', 'Exchange Rate')}</div>
          <div>{fbt('Your Balance', 'Your Balance')}</div>
        </div>
        <CoinRow
          coin="dai"
          onOusdChange={setDaiOusd}
          onCoinChange={setDai}
        />
        <CoinRow
          coin="usdt"
          onOusdChange={setUsdtOusd}
          onCoinChange={setUsdt}
        />
        <CoinRow
          coin="usdc"
          onOusdChange={setUsdcOusd}
          onCoinChange={setUsdc}
        />
        <div className="horizontal-break d-flex align-items-center justify-content-center">
          <img src="/images/down-arrow.svg"/>
        </div>
        <div className="ousd-section d-flex justify-content-between">
          <div className="approx-purchase d-flex align-items-center justify-content-start">
            <div>
              {fbt('Approx. purchase amount', 'Approx. purchase amount')}
            </div>
            <a
              className="ml-2"
              onClick={ e => {
                e.preventDefault()
              }}>
              <img className="question-icon" src="/images/question-icon.svg"/>
            </a>
          </div>
          <div className="ousd-estimation d-flex align-items-center justify-content-start">
            <img src="/images/currency/ousd-icon.svg"/>
            <div className="value">{formatCurrency(daiOusd + usdcOusd + usdtOusd)} OUSD</div>
            <div className="balance ml-auto">{formatCurrency(ousdBalance)} OUSD</div>
          </div>
        </div>
        <div className="actions d-flex justify-content-end">
          <button
            className="btn-blue"
            onClick={onBuyNow}
          >
            {fbt('Buy now', 'Buy now')}
          </button>
        </div>
      </div>}
      {tab === 'sell' && <div className="sell-table">
        <div className="header d-flex">
          <div>{fbt('Asset', 'Asset')}</div>
          <div className="ml-auto text-right">{fbt('Your Balance', 'Your Balance')}</div>
        </div>
        <div className="ousd-estimation d-flex align-items-center justify-content-start">
          <img className="ml-2" src="/images/currency/ousd-icon.svg"/>
          <input
            type="float"
            className="ml-4"
            placeholder="0.00"
            value={ousdToSell}
            onChange={e => {
              let value = e.target.value
              setOusdToSell(value)
            }}
            onBlur={ e => {
              setOusdToSell(formatCurrency(Math.min(ousdToSell, ousdBalance)))
            }}
          />
          <div className="balance ml-auto">{formatCurrency(ousdBalance)} OUSD</div>
        </div>
        <div className="horizontal-break d-flex align-items-center justify-content-center">
          <img src="/images/down-arrow.svg"/>
        </div>
        <div className="withdraw-section d-flex">
          <CoinWithdrawBox
            active={selectedSellCoin === 'usdt'}
            onClick={ e => {
              e.preventDefault()
              setSelectedSellCoin('usdt')
            }}
            coin="usdt"
            exchangeRate={0.96}
            ousdAmount={ousdToSell}
          />
          <CoinWithdrawBox 
            active={selectedSellCoin === 'dai'}
            onClick={ e => {
              e.preventDefault()
              setSelectedSellCoin('dai')
            }}
            coin="dai"
            exchangeRate={0.96}
            ousdAmount={ousdToSell}
          />
          <CoinWithdrawBox
            active={selectedSellCoin === 'usdc'}
            onClick={ e => {
              e.preventDefault()
              setSelectedSellCoin('usdc')
            }}
            coin="usdc"
            exchangeRate={0.96}
            ousdAmount={ousdToSell}
          />
        </div>
        <div className="actions d-flex justify-content-end">
          <button
            className="btn-blue"
            onClick={onSellNow}
          >
            {fbt('Sell now', 'Sell now')}
          </button>
        </div>
      </div>}
    </div>
    <style jsx>{`
      .buy-sell-widget {
        margin: 0px -1px -1px -1px;
        border-radius: 0px 0px 10px 10px;
        border: solid 1px #cdd7e0;
        background-color: #fafbfc;
        min-height: 470px;
        padding: 25px 40px 40px 40px;
        position: relative;
      }

      .buy-sell-widget .header {
        font-size: 12px;
        font-weight: bold;
        color: #8293a4;
        margin-top: 18px;
        margin-bottom: 9px;
      }

      .buy-sell-widget .header>div {
        width: 87px;
      }

      .buy-sell-widget .tab-navigation a {
        font-size: 14px;
        font-weight: bold;
        color: #1a82ff;
        padding-bottom: 5px;
        margin-right: 40px;
        cursor: pointer;
      }

      .buy-sell-widget .tab-navigation a.active {
        color: #1e313f;
        border-bottom: solid 1px #1e313f;
      }

      .buy-sell-widget .horizontal-break {
        width: 100%;
        height: 1px;
        background-color: #dde5ec;
        margin-top: 20px;
        margin-bottom: 30px;
      }

      .buy-sell-widget .ousd-section {
        margin-bottom: 31px;
      }
          
      .buy-sell-widget .ousd-section .approx-purchase {
        min-width: 190px;
        font-size: 12px;
        font-weight: bold;
        color: #8293a4;
      }
            
      .buy-sell-widget .ousd-estimation {
        width: 350px;
        height: 50px;
        border-radius: 5px;
        border: solid 1px #cdd7e0;
        background-color: #f2f3f5;
        padding: 14px;
      }

      .buy-sell-widget .ousd-estimation .value {
        font-size: 18px;
        color: black;
        margin-left: 10px;
      }
              
      .buy-sell-widget .ousd-estimation .balance {
        font-size: 12px;
        color: #8293a4;
      }
      
      .buy-sell-widget .sell-table .ousd-estimation {
        width: 100%;
      }     

      .buy-sell-widget .sell-table .header {
        margin-top: 24px;
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
      }

      .withdraw-section {
        margin-left: -10px;
        margin-right: -10px;
        margin-bottom: 30px;
      }

    `}</style>
  </>
}

export default withRpcProvider(BuySellWidget)
