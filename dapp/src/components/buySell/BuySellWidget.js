import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import { AccountStore } from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import CoinRow from 'components/buySell/CoinRow'
import ApproveModal from 'components/buySell/ApproveModal'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math.js'

const BuySellWidget = () => {
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
  const { Vault, MockUSDT, MockDAI, MockUSDC } = useStoreState(ContractStore, s => s.contracts || {})

  const onMintOusd = async () => {
    if (usdt > 0) {
      await Vault.depositAndMint(
        MockUSDT.address,
        ethers.utils.parseUnits(usdt, await MockUSDT.decimals())
      )
    }
    if (usdc > 0) {
      await Vault.depositAndMint(
        MockUSDC.address,
        ethers.utils.parseUnits(usdc, await MockUSDC.decimals())
      )
    }
    if (dai > 0) {
      await Vault.depositAndMint(
        MockDAI.address,
        ethers.utils.parseUnits(dai, await MockDAI.decimals())
      )
    }
  }

  const onBuyNow = async e => {
    e.preventDefault()
    const needsApproval = []

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
      //todo: just go directly to purchase
      await onMintOusd()
    }
  }

  //TODO: CLEAR LOCAL STORAGE COIN SELECTS WHEN BUYING SUCCESSFUL


  return <>
    <div className="buy-sell-widget d-flex flex-column">
      {showApproveModal && <ApproveModal
        currenciesNeedingApproval={currenciesNeedingApproval}
        onClose={ e => {
          e.preventDefault()
          setShowApproveModal(false)
        }}
        onFinalize={ async () => {
          await onMintOusd()
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
            
      .buy-sell-widget .ousd-section .ousd-estimation {
        width: 350px;
        height: 50px;
        border-radius: 5px;
        border: solid 1px #cdd7e0;
        background-color: #f2f3f5;
        padding: 14px;
      }

      .buy-sell-widget .ousd-section .ousd-estimation .value {
        font-size: 18px;
        color: black;
        margin-left: 10px;
      }
              
      .buy-sell-widget .ousd-section .ousd-estimation .balance {
        font-size: 12px;
        color: #8293a4;
      }
              
    `}</style>
  </>
}

export default BuySellWidget
