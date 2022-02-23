import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'
import Link from 'next/link'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'

import EtherscanLink from 'components/earn/EtherscanLink'
import { assetRootPath } from 'utils/image'
import { adjustLinkHref } from 'utils/utils'

export default function LiquidityWizard({ pool, onHideWizzard }) {
  const ousd = Number(useStoreState(AccountStore, (s) => s.balances).ousd)
  const [defaultActiveStep, setDefaultActiveStep] = useState(null)
  const [activeStep, setActiveStep] = useState(null)
  const lpTokens = Number(pool.lp_tokens)

  const getDefaultActiveStep = () => {
    if (ousd === 0 && lpTokens === 0) {
      return 1
    } else if (ousd > 0 && lpTokens === 0) {
      return 2
    } else {
      return 3
    }
  }

  useEffect(() => {
    if (Number.isNaN(ousd) || Number.isNaN(lpTokens)) {
      return
    }

    const defaultActiveStep = getDefaultActiveStep()
    setDefaultActiveStep(defaultActiveStep)
    setActiveStep(defaultActiveStep)
  }, [ousd, lpTokens])

  const getStepClass = (stepNumber) => {
    // not initialised yet
    if (defaultActiveStep === null || activeStep === null) {
      return 'grey'
    }

    const isDone = defaultActiveStep > stepNumber

    if (activeStep === stepNumber) {
      return 'active' + (isDone ? ' done' : '')
    } else if (activeStep < stepNumber) {
      return 'grey' + (isDone ? ' done' : '')
    }
    return 'done'
  }

  return (
    <>
      <div className="d-flex body">
        <div className="steps-holder">
          <div className="title">
            {fbt(
              'How to Earn OGN by Providing Liquidity to OUSD',
              'wizzard helper title'
            )}
          </div>
          <div className="steps">
            <div
              className={`step ${getStepClass(1)}`}
              onClick={(e) => {
                setActiveStep(1)
              }}
            >
              <div className="step-number">
                <img
                  className="checkmark"
                  src={assetRootPath('/images/checkmark.svg')}
                />
                1
              </div>
              <div>{fbt('Purchase OUSD', 'Purchase OUSD')}</div>
            </div>
            <div
              className={`step ${getStepClass(2)}`}
              onClick={(e) => {
                setActiveStep(2)
              }}
            >
              <div className="step-number">
                <img
                  className="checkmark"
                  src={assetRootPath('/images/checkmark.svg')}
                />
                2
              </div>
              <div>{fbt('Provide liquidity', 'Provide liquidity')}</div>
            </div>
            <div
              className={`step ${getStepClass(3)}`}
              onClick={(e) => {
                setActiveStep(3)
              }}
            >
              <div className="step-number">
                <img
                  className="checkmark"
                  src={assetRootPath('/images/checkmark.svg')}
                />
                3
              </div>
              <div>{fbt('Deposit to earn OGN', 'Deposit to earn OGN')}</div>
            </div>
          </div>
        </div>
        <div
          className={`graphic-holder d-flex flex-column align-items-center justify-content-start flex-grow-1 step-${activeStep}`}
        >
          {activeStep === null && (
            <div className="w-100 h-100 d-flex align-items-center justify-content-center">
              <h3>{fbt('Loading...', 'Loading...')}</h3>
            </div>
          )}
          {activeStep === 1 && (
            <>
              <img
                className="ousd-icon"
                src={assetRootPath('/images/ousd-coin.svg')}
              />
              <div className="big-title">
                {fbt(
                  'Get OUSD by minting it or buying it on an exchange',
                  'Wizard purchase OUSD text'
                )}
              </div>
              <Link href={adjustLinkHref('/swap')}>
                <a className="btn-blue h-40">{fbt('Swap OUSD', 'Swap OUSD')}</a>
              </Link>
            </>
          )}
          {activeStep === 2 && (
            <>
              <img
                className="uniswap-icon"
                src={assetRootPath('/images/uniswap-icon-white.svg')}
              />
              <div className="big-title">
                {fbt(
                  'Provide ' +
                    fbt.param('pool name', pool.name) +
                    ' liquidity on Uniswap',
                  'Provide liquidity header'
                )}
              </div>
              <div className="subtitle">
                {fbt(
                  "Remember, your OUSD will not grow while it's in Uniswap, but you will earn fees for providing liquidity.",
                  'Uniswap step subtitle'
                )}
              </div>
              <a href="#" className="link">
                {fbt('Learn more', 'Learn more')}
              </a>
              <a
                className="btn-blue dark h-40"
                href={`https://uniswap.exchange/add/${pool.coin_one.contract_address}/${pool.coin_two.contract_address}`}
              >
                {fbt('Visit Uniswap', 'Visit Uniswap')}
              </a>
            </>
          )}
          {activeStep === 3 && (
            <>
              <img
                className="ogn-icon"
                src={assetRootPath('/images/ogn-icon-blue.svg')}
              />
              <div className="big-title">
                {fbt(
                  'Deposit your LP tokens and start earning OGN',
                  'Wizard deposit LP tokens text'
                )}
              </div>
              <a
                className="btn-blue dark h-40"
                onClick={(e) => {
                  e.preventDefault()
                  onHideWizzard()
                }}
              >
                {fbt('Take me there', 'Take me there')}
              </a>
            </>
          )}
        </div>
      </div>
      <div className="footer-links d-flex justify-content-center">
        <EtherscanLink
          text={fbt('Pool Contract', 'Pool Contract')}
          href={pool.pool_contract_address}
          className="mr-29"
        />
        {/* TODO Update Rewards contract address */}
        <EtherscanLink
          text={fbt('Rewards Contract', 'Rewards Contract')}
          href={pool.pool_contract_address}
        />
      </div>
      <style jsx>{`
        .body {
          min-height: 438px;
        }

        .steps-holder {
          width: 320px;
          min-height: 100%;
          background-color: white;
          border-radius: 10px 0px 0px 10px;
          border: solid 1px #cdd7e0;
          padding: 30px;
        }

        .graphic-holder {
          min-height: 100%;
          border-radius: 0px 10px 10px 0px;
          border: solid 1px #cdd7e0;
          border-left: 0px;
          padding: 0xp 49px 30px 49px;
        }

        .steps {
          font-size: 18px;
          font-weight: bold;
          color: black;
        }

        .step {
          margin-bottom: 15px;
          padding-bottom: 5px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .step:hover:not(.active) {
          cursor: pointer;
          text-decoration: underline;
        }

        .steps .step-number {
          color: white;
          margin-right: 11px;
          font-weight: normal;
          border-radius: 15px;
          position: relative;
        }

        .step.active {
          color: black !important;
        }

        .step.active .step-number {
          background-color: #183140 !important;
        }

        .step .checkmark {
          visibility: hidden;
          position: absolute;
          right: -5px;
          bottom: -4px;
        }

        .step.done .checkmark {
          visibility: inherit;
        }

        .step.done,
        .step.grey {
          color: #bbc9da;
        }

        .step.done .step-number,
        .step.grey .step-number {
          background-color: #bbc9da;
        }

        .step-number {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .title {
          font-size: 24px;
          line-height: 1.29;
          color: #1e313f;
          margin-top: 50px;
          margin-bottom: 25px;
        }

        .graphic-holder .ousd-icon {
          width: 121px;
          height: 121px;
          margin-top: 77px;
          margin-bottom: 34px;
        }

        .graphic-holder .ogn-icon {
          width: 120px;
          height: 120px;
          margin-top: 79px;
          margin-bottom: 33px;
        }

        .graphic-holder .uniswap-icon {
          width: 92px;
          height: 108px;
          margin-top: 48px;
          margin-bottom: 28px;
        }

        .graphic-holder.step-1 {
          background-color: #183140;
          background-image: url('/images/earn-coin-waves-grey.svg');
          background-repeat: no-repeat;
          background-position: center top;
        }

        .graphic-holder.step-2 {
          background-image: radial-gradient(
            circle at 50% 30%,
            #ab71ff,
            #7a26f3 60%
          );
        }

        .graphic-holder.step-3 {
          background-color: #1a82ff;
          background-image: url('/images/earn-coin-waves-blue.svg');
          background-repeat: no-repeat;
          background-position: center top;
        }

        .big-title {
          font-size: 28px;
          text-align: center;
          color: white;
          max-width: 390px;
          line-height: 1.2;
          margin-bottom: 40px;
        }

        .graphic-holder.step-2 .big-title {
          max-width: 540px;
          margin-bottom: 10px;
        }

        .subtitle {
          opacity: 0.8;
          font-size: 18px;
          text-align: center;
          color: white;
          margin-bottom: 3px;
          max-width: 490px;
          line-height: 1.2;
        }

        .footer-links {
          margin-top: 52px;
        }

        .h-40 {
          max-height: 40px;
        }

        .btn-blue.dark {
          cursor: pointer;
          background-color: #183140;
        }

        .btn-blue.dark:hover {
          background-color: #001120;
          color: #8293a4;
        }

        .link {
          margin-bottom: 35px;
          font-size: 14px;
          text-align: center;
          color: white;
          opacity: 0.8;
        }

        .link:hover {
          opacity: 1;
        }

        .link::after {
          content: '>';
          margin-left: 5px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
