import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import withLoginModal from 'hoc/withLoginModal'
import StakeStore from 'stores/StakeStore'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import ClaimStakeModal from 'components/ClaimStakeModal'
import WarningAlert from 'components/WarningAlert'
import { formatCurrency } from 'utils/math'
import ContractStore from 'stores/ContractStore'

import { injected } from 'utils/connectors'
import mixpanel from 'utils/mixpanel'
import { providerName } from 'utils/web3'
import { isMobileMetaMask } from 'utils/device'
import useStake from 'utils/useStake'

function Compensation({ locale, onLocale, showLogin }) {
  const { stakeOptions } = useStake()
  const { activate, active, account } = useWeb3React()
  const [compensationData, setCompensationData] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [displayAdjustmentWarning, setDisplayAdjustmentWarning] = useState(true)
  const [accountConnected, setAccountConnected] = useState(false)
  const [ognCompensationAmount, setOGNCompensationAmount] = useState(0)
  const airDroppedOgnClaimed = useStoreState(StakeStore, (s) => s.airDropStakeClaimed)
  const { ognStaking } = useStoreState(ContractStore, (s) => {
    if (s.contracts) {
      return s.contracts
    }
    return {}
  })

  const fetchCompensationInfo = async (wallet) => {
    const result = await fetch(
      `${location.origin}/api/compensation?wallet=${wallet}`
    )
    if (result.ok) {
      const jsonResult = await result.json();
      setCompensationData(jsonResult)
      setOGNCompensationAmount(formatCurrency(
        ethers.utils.formatUnits(jsonResult.account.amount, 18),
        2
      ))
    } else {
      // TODO: handle error or no complensation available
      setCompensationData(null)
      setOGNCompensationAmount(0)
    }
  }

  const loginConnect = () => {
    if (process.browser) {
      mixpanel.track('Connect', {
        source: "Compensation page",
      })
        const provider = providerName() || ''
        if (
          provider.match(
            'coinbase|imtoken|cipher|alphawallet|gowallet|trust|status|mist|parity'
          ) ||
          isMobileMetaMask()
        ) {
          activate(injected)
        } else if(showLogin) {
          showLogin()
        }
    }
  } 

  useEffect(() => {
    if (active && account) {
      fetchCompensationInfo(account)
      setAccountConnected(true)
    }else {
      setAccountConnected(false)
    }
  }, [active, account])

  if (process.env.ENABLE_COMPENSATION !== 'true') {
    return ''
  }

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp medium>
        <Nav dapp page={'compensation'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <div className="d-flex align-items-center flex-column flex-md-row">
            <div className="bold-text mr-md-3">
              {fbt('OUSD Exploit Compensation', 'OUSD Exploit Compensation')}
            </div>
            <div className="grey-text-link d-flex align-items-center">
              {fbt(
                'How is my compensation calculated?',
                'How is compensation calculated'
              )}
            </div>
          </div>
          <div className="widget-holder row">
            <div className="top-balance-widget d-flex align-items-center justify-content-center flex-column">
              
            {!accountConnected ? (<div className="not-connected d-flex align-items-center justify-content-center flex-column"> 
              <img className="wallet-icons" src="/images/wallet-icons.svg" />
                <h3>{fbt('Connect a cryptowallet to see your compensation', 'Connect a cryptowallet to see your compensation')}</h3>
                <button className="btn btn-primary" onClick={async () => loginConnect()}>
                    {fbt('Connect', 'Connect')}
                  </button>
              </div>) : compensationData ? (
                <>
                  <div className="eligible-text">
                    <p>{fbt(
                      'OUSD balance at block ' + fbt.param('Block number', 11272254),
                      'OUSD balance at block'
                    )}</p>
                    <h1>1,234.56</h1>
                  </div>
                  <div className="widget-message mt-auto w-100">
                    <p>Compensation for <strong>100% of this OUSD balance</strong> is split evenly 50/50 as shown below</p>
                  </div>
                </>
              ) : (
                <h1 className="not-eligible-text">
                  {fbt('This wallet is not eligible for compensation', 'This wallet is not eligible for compensation')}
                </h1>
              )}
            </div>
            <div className={`ousd-widget col-md-6 d-flex align-items-center flex-column${!accountConnected ? ' big-top-widget': ''}`}>
              <img className="ousd-coin" src="/images/ousd-coin-big.svg" />
              <div className="widget-title bold-text">
                {fbt('OUSD Compensation Amount', 'OUSD Compensation Amount')}
              </div>
              {accountConnected && compensationData ? (
                <>
                  <div className="token-amount">
                    {ognCompensationAmount}
                  </div>
                  <p>{fbt('Available now', 'Available now')}</p>
                  <button className="btn btn-primary" onClick={async (e) => {}}>
                    {fbt('Claim OUSD', 'Claim OUSD')}
                  </button>
                </>
              ) : (
                <>
                  <div className="token-amount">0.00</div>
                </>
              )}
            </div>
            <div className={`ogn-widget col-md-6 d-flex align-items-center flex-column${accountConnected ? airDroppedOgnClaimed ? ' claimed' : '' : ' big-top-widget'}`}>
              <img className="ogn-coin" src="/images/ogn-coin-big.svg" />
              <div className="widget-title bold-text">
                {fbt('OGN Compensation Amount', 'OGN Compensation Amount')}
              </div>
              {accountConnected && compensationData ? (
                <>
                  <div className="token-amount">
                    {ognCompensationAmount}
                  </div>
                  <div className="price-and-stake d-flex">
                    <p>{fbt('@ OGN price of', '@ OGN price of')} $0.15</p>
                    <span> | </span>
                    <p>{fbt('Staking duration', 'Staking duration')}: {stakeOptions.length === 3 ? stakeOptions[2].durationInDays: '0'} days</p>
                  </div>
                  {airDroppedOgnClaimed ? <h3>{fbt('CLAIMED', 'CLAIMED')}</h3> : <>
                    <ClaimStakeModal showModal={showModal} setShowModal={setShowModal} ognCompensationAmount={ognCompensationAmount}/>
                    <button
                      className="btn btn-dark"
                      onClick={async () => setShowModal(true)}
                    >
                      {fbt('Claim & Stake OGN', 'Claim & Stake OGN button')}
                    </button>
                  </>}
                </>
              ) : (
                <>
                  <div className="token-amount">0.00</div>
                </>
              )}
              <a href="#">{fbt('Learn about OGN >', 'Learn about OGN')}</a> 
            </div>
          </div>
          <WarningAlert showWarning = {displayAdjustmentWarning} text={fbt('These amounts have been adjusted based on your trading activity after the OUSD exploit', 'Warning text')} />
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding: 80px 10px 0px;;
        }

        .bold-text {
          font-size: 14px;
          font-weight: bold;
          color: white;
        }

        .grey-text-link {
          font-size: 14px;
          color: #8293a4;
        }

        .grey-text-link:after {
          content: '';
          background-image: url(/images/link-icon-grey.svg);
          background-size: 14px 14px;
          display: inline-block;
          width: 14px;
          height: 14px;
          margin-left: 7px;
        }

        .grey-text-link:hover {
          cursor: pointer;
          text-decoration: underline;
        }

        .top-balance-widget {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          min-height: 178px;
          color: #000;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          z-index: 1;
          overflow: hidden;
        }

        .not-connected .wallet-icons {
          padding: 49px 10px 23px; 
          margin: 0px;
        }

        .not-connected h3 {
          text-align: center; 
          margin: 0px; 
          padding: 0px 10px;
          font-family: Lato;
          font-size: 22px;
          line-height: 0.86;
        }

        .not-connected .btn {
          margin: 45px 10px;
          width: 201px;
          height: 50px;
        }
        .eligible-text {
          padding: 35px 0px 0px;
          text-align: center;
        }

        .not-eligible-text {
          font-family: Lato;
          font-size: 28px;
          margin: 0px;
          padding: 10px;
        }

        .top-balance-widget p {
          margin: 0px;
          font-size: 0.86rem;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: 8px;
        }

        .widget-message {
          background-color: #fafbfc;
          border-top: solid 1px #cdd7e0;
        }

        .widget-message p {
          padding: 10px;
          text-align: center;
          margin: 0px;
          font-size: 0.86rem;
          color: #8293a4;
          font-weight: normal;
        }

        .widget-message strong {
          color: #000;
        }

        .widget-holder {
          margin: 20px 0;
          position: relative;
          color: white;
        }

        .ousd-widget {
          background-color: #183140;
          border-radius: 10px 0px 10px 10px;
          padding: 232px 10px 40px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #000000;
        }

        .ousd-widget p {
          margin-bottom: 33px;
          font-size: 14px;
          opacity: 0.8;
        }

        .ogn-widget {
          background-color: #1a82ff;
          border-radius: 0px 10px 10px 10px;
          padding: 232px 10px 40px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #065ac0;
        }

        .ogn-widget h3 {
          font-family: Lato;
          font-size: 18px;
          font-weight: bold;
          line-height: normal;
          margin: 0px;
        }

        .ogn-widget a {
          margin-top: 22px; 
          opacity: 0.8; 
          font-size: 14px;
        }
        
        .ogn-coin, .ousd-coin {
          margin-bottom: 17px;
        }

        .token-amount {
          font-family: Lato;
          font-size: 42px;
          color: #fff;
          line-height: normal;
          text-align: center;
        }
        
        .price-and-stake {
          opacity: 0.8; 
          font-size: 14px;
          text-align: center;
        }

        .price-and-stake p {
          margin: 0px;
        }

        .price-and-stake span {
          padding: 0px 10px;
        }

        .widget-holder .btn {
          padding-left: 28px;
          padding-right: 28px;
          min-width: 211px;
          border-radius: 25px;  
          font-family: Lato;
          font-size: 18px;
          font-weight: bold;
        }

        .widget-holder .btn-primary {    
          background-color: #1a82ff;
          border-color: #1a82ff;
        }

        .price-and-stake {
          margin-bottom: 33px;
        }

        .claimed .widget-title, .claimed .price-and-stake {
          opacity: 0.5;
        }

        .claimed .token-amount {
          text-decoration: line-through;
          opacity: 0.5;
        }

        .big-top-widget {
          padding: 400px 10px 40px;
        }

        @media (max-width: 768px) {
          .home {
            padding: 80px 0 0;
          }

          .top-balance-widget {
            position: relative; 
            border-radius: 0px;
          }

          .ousd-widget, .ogn-widget {
            padding: 40px 20px; 
            border-radius: 0px;
          }

          .eligible-text{
            padding: 35px 0;
          }

          .ousd-widget .btn, .ogn-widget .btn{
            width: 100%;
          }

          .price-and-stake span {
            padding: 0px 5px;
          }
        }
      `}</style>
    </>
  )
}

export default withLoginModal(Compensation);