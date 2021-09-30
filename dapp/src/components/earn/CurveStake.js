import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import withIsMobile from 'hoc/withIsMobile'
import analytics from 'utils/analytics'

const CurveStake = ({ rpcProvider, isMobile }) => {
  const { active } = useWeb3React()

  return (
    <>
      <>
        <div className="home d-flex flex-column">
          <div className="crv-header">
            <h1>
              {fbt(
                'Earn OGN and CRV rewards by providing liquidity on Curve',
                'Earn OGN curve title'
              )}
            </h1>
            <div className="d-flex flex-md-row flex-column w-100 ">
              <div className="box mr-md-10 d-flex flex-column align-items-center justify-content-center">
                <div className="title">{fbt('Total APY', 'Total APY')}</div>
                <div className="value">5.5%</div>
              </div>
              <div className="box group flex-grow-1">
                <div className="d-flex flex-md-row flex-column h-100">
                  <div className="box-item d-flex flex-row flex-md-column border-right-md col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('Base APY', 'Base APY')}</div>
                    <div className="value">5.5%</div>
                  </div>
                  <div className="box-item d-flex flex-row flex-md-column border-right-md col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('CRV APY', 'CRV APY')}</div>
                    <div className="value">6-7.5%</div>
                  </div>
                  <div className="d-flex flex-row flex-md-column col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('OGN APY', 'OGN APY')}</div>
                    <div className="value">12.25%</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="curve-logo-holder d-flex">
              <div className="powered-by">
                {fbt('Powered by', 'Powered by')}
              </div>
              <img src="/images/curve-logo-smaller.svg" />
            </div>
          </div>
          <div className="crv-body d-flex flex-md-row flex-column">
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start border-right2-md border-bottom">
              <div className="step d-flex align-items-center justify-content-center">
                1
              </div>
              <div className="text-center description pl-md-0">
                {fbt(
                  'Provide OUSD + USDT/USDC/ DAI liquidity to the Curve OUSD pool',
                  'Provide OUSD + USDT/USDC/DAI liquidity to the Curve OUSD pool'
                )}
              </div>
            </div>
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start border-right2-md border-bottom">
              <div className="step d-flex align-items-center justify-content-center">
                2
              </div>
              <div className="text-center description">
                {fbt(
                  'Click “Deposit & stake in gauge”',
                  'Click “Deposit & stake in gauge”'
                )}
              </div>
              <a
                href="https://curve.fi/factory/9/deposit"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-blue mt-md-auto"
                onClick={() => {
                  analytics.track('On Add Liquidity', {
                    category: 'navigation',
                  })
                }}
              >
                {fbt('Add Liquidity', 'Add Liquidity Button')}
              </a>
            </div>
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start">
              <div className="step d-flex align-items-center justify-content-center">
                3
              </div>
              <div className="text-center description pr-md-0">
                {fbt(
                  'Once staked, click the “Claim” button on Curve to claim your OGN & CRV rewards',
                  'Once staked, click the “Claim” button on Curve to claim your OGN & CRV rewards'
                )}
              </div>
              <a
                href="https://curve.fi/factory/9/withdraw"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-blue mt-md-auto"
                onClick={() => {
                  analytics.track('On Claim Rewards', {
                    category: 'navigation',
                  })
                }}
              >
                {fbt('Claim Rewards', 'Claim Rewards Button')}
              </a>
            </div>
          </div>
        </div>
      </>
      <style jsx>{`
        .home {
          min-width: 940px;
          border-radius: 10px;
          box-shadow: 0 2px 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #dfe9ee;
          background-color: white;
          padding: 60px 0px 0px 0px;
        }

        .crv-header {
          padding: 0px 44px;
          margin-bottom: 60px;
          position: relative;
        }

        .curve-logo-holder {
          position: absolute;
          bottom: -40px;
          right: 20px;
        }

        .crv-body {
          border-radius: 0 0 10px 10px;
          border-top: solid 1px #e9eff4;
          background-color: #fafbfc;
          padding: 40px 30px;
        }

        .step {
          width: 50px;
          height: 50px;
          border-radius: 25px;
          background-color: #183140;
          color: white;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 25px;
        }

        h1 {
          font-family: Poppins;
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          color: black;
          margin-bottom: 25px;
        }

        .box {
          border-radius: 10px;
          border: solid 1px black;
          background-color: #183140;
          color: white;
          min-height: 126px;
          min-width: 266px;
        }

        .box .title {
          font-size: 18px;
          margin-bottom: -3px;
        }

        .box .value {
          font-size: 36px;
          font-value: bold;
        }

        .mr-md-10 {
          margin-right: 10px;
        }

        .box.group {
          padding-top: 20px;
          padding-bottom: 20px;
        }

        .box.group .title {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .box.group .value {
          font-size: 18px;
          font-weight: bold;
        }

        .border-right-md {
          border-right: solid 1px #000;
        }

        .border-right2-md {
          border-right: solid 1px #cdd7e0;
        }

        .border-bottom {
          border-bottom: 0;
        }

        .step-holder {
          min-height: 240px;
        }

        .description {
          font-size: 18px;
          padding: 0px 30px;
        }

        a.btn {
          margin: 0px 20px;
          padding: 0px 40px;
        }

        .powered-by {
          font-size: 10px;
          color: #576c7a;
        }

        @media (max-width: 799px) {
          .mr-md-10 {
            margin-right: 0px;
          }

          .home {
            min-width: auto;
            padding: 40px 0px 0px 0px;
          }

          h1 {
            font-size: 20px;
            margin-bottom: 20px;
          }

          .crv-header {
            padding: 0px 20px;
            margin-bottom: 40px;
          }

          .curve-logo-holder {
            bottom: -30px;
          }

          .border-right2-md {
            border-right: 0;
          }

          .border-right-md {
            border-right: 0;
          }

          .border-bottom {
            border-bottom: solid 1px #cdd7e0;
          }

          .crv-body {
            padding: 10px 30px;
          }

          .box {
            min-height: 126px;
            min-width: auto;
            margin-bottom: 10px;
          }

          .box.group {
            margin-bottom: 0px;
          }

          .box-item {
            margin-bottom: 20px;
          }

          .step-holder {
            min-height: auto;
            padding: 30px 0px;
          }

          .description {
            font-size: 16px;
            padding: 0px 15px;
          }

          a.btn {
            margin-top: 25px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(CurveStake)
