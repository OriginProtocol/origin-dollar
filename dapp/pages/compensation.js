import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import { formatCurrency } from 'utils/math'
import ContractStore from 'stores/ContractStore'

export default function DApp({ locale, onLocale }) {
  const { active, account } = useWeb3React()
  const [compInfo, setCompinfo] = useState(null)
  const { ognStaking } = useStoreState(
    ContractStore,
    (s) => {
      if (s.contracts) {
        return s.contracts
      }
      return {}
    }
  )

  const fetchCompensationInfo = async (wallet) => {
    const result = await fetch(`${location.origin}/api/compensation?wallet=${wallet}`)
    if (result.ok) {
      setCompinfo(await result.json())
    } else {
      // TODO: handle error or no complensation available 
      setCompinfo(null)
    }
  }

  useEffect(() => {
    if (active && account) {
      fetchCompensationInfo(account)
    }
  }, [active, account])

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav
          dapp
          page={'compensation'}
          locale={locale}
          onLocale={onLocale}
        />
        <div className="home d-flex flex-column">
          <div className="d-flex align-items-center">
            <div className="bold-text mr-3">{fbt('OUSD Exploit Compensation', 'OUSD Exploit Compensation')}</div>
            <div className="grey-text-link">{fbt('How is my compensation calculated?', 'How is compensation calculated')}</div>
          </div>
          <div className="widget-holder d-flex">
            <div className="top-balance-widget">
              
            </div>
            <div className="col-6 ousd-widget d-flex flex-column">
              asd
            </div>
            <div className="col-6 ogn-widget d-flex flex-column">
              {compInfo && <div className="d-flex align-items-center justify-content-start flex-column">
                <img className="ogn-coin" src="/images/ogn-coin-big.svg" />
                <div className="bold-text mb-2">{fbt('OGN Compensation Amount', 'OGN Compensation Amount')}</div>
                <div className="token-amount">{formatCurrency(ethers.utils.formatUnits(compInfo.account.amount, 18), 2)}</div>
                <div className="d-flex price-and-stake"></div>
                <button
                  className="btn-dark"
                  onClick={async (e) => {
                    console.log("GONNA DO THIS: ", compInfo.account.index, compInfo.account.type, compInfo.account.duration, compInfo.account.rate, compInfo.account.amount, compInfo.account.proof)
                    const result = await ognStaking.airDroppedStake(
                      compInfo.account.index,
                      compInfo.account.type,
                      compInfo.account.duration,
                      compInfo.account.rate,
                      compInfo.account.amount,
                      compInfo.account.proof
                    )
                    console.log("RESULT: ", result)
                  }}
                >{fbt('Claim & Stake OGN', 'Claim & Stake OGN button')}</button>
              </div>}
              {!compInfo && <div>No compansation for you buddy</div>}
            </div>
          </div>
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding-top: 80px;
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
          content: "";
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

        .widget-holder {
          position: relative;
          min-height: 532px;
          color: white;
          margin-top: 20px;
        }

        .ousd-widget {
          background-color: #183140;
          border-radius: 10px 0px 10px 10px;
          min-height: 532px;
          padding-top: 232px;
        }

        .ogn-widget {
          background-color: #1a82ff;
          border-radius: 0px 10px 10px 10px;
          min-height: 532px;
          padding-top: 232px;
        }

        .top-balance-widget {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 178px;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          z-index: 1;
        }

        .ogn-coin {
          margin-bottom: 17px;
        }

        .token-amount {
          font-family: Lato;
          font-size: 42px;
          color: white;
        }

        .btn-dark {
          padding-left: 28px;
          padding-right: 28px;
        }

        .price-and-stake {
          margin-bottom: 33px;
        }

        @media (max-width: 799px) {
          .home {
            padding: 0;
          }
        }
      `}</style>
    </>
  )
}
