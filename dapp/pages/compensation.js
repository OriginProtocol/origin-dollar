import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import withRpcProvider from 'hoc/withRpcProvider'

import ContractStore from 'stores/ContractStore'
import withWalletSelectModal from 'hoc/withWalletSelectModal'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import ClaimStakeModal from 'components/ClaimStakeModal'
import WarningAlert from 'components/WarningAlert'
import { sleep } from 'utils/utils'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import { useAnalytics } from 'use-analytics'
import useStake from 'hooks/useStake'
import useCompensation from 'hooks/useCompensation'
import { formatCurrency } from 'utils/math'
import { walletLogin } from 'utils/account'
import { assetRootPath } from 'utils/image'

function Compensation({ locale, onLocale, showLogin, rpcProvider }) {
  const { stakeOptions } = useStake()
  const { activate, active, account } = useWeb3React()
  const [showModal, setShowModal] = useState(false)
  const [displayAdjustmentWarning, setDisplayAdjustmentWarning] = useState(true)
  const [accountConnected, setAccountConnected] = useState(false)
  const [waitingForTransaction, setWaitingForTransaction] = useState(false)
  const [error, setError] = useState(null)
  const {
    blockNumber,
    eligibleOusdBalance,
    compensationData,
    ognCompensationAmount,
    ousdCompensationAmount,
    fetchCompensationOUSDBalance,
    ousdClaimed,
    queryDataUntilAccountChange,
    remainingOUSDCompensation,
    ognClaimed,
  } = useCompensation()
  const { track } = useAnalytics()
  const { compensation: compensationContract } = useStoreState(
    ContractStore,
    (s) => {
      if (s.contracts) {
        return s.contracts
      }
      return {}
    }
  )

  const loginConnect = () => {
    if (process.browser) {
      track('Connect', {
        source: 'Compensation page',
      })

      walletLogin(showLogin, activate)
    }
  }

  useEffect(() => {
    setAccountConnected(active && account)
  }, [active, account])

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp medium>
        <Nav dapp page={'compensation'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <div className="d-flex align-items-center flex-column flex-md-row">
            <div className="bold-text mr-md-3">
              {fbt('OUSD Exploit Compensation', 'OUSD Exploit Compensation')}
            </div>
            <a
              className="grey-text-link d-flex align-items-center"
              href="https://medium.com/originprotocol/origin-dollar-ousd-detailed-compensation-plan-faa73f87442e"
              target="_blank"
              rel="noopener noreferrer"
            >
              {fbt(
                'How is my compensation calculated?',
                'How is compensation calculated'
              )}
            </a>
          </div>
          <div className="widget-holder row">
            <div className="top-balance-widget d-flex align-items-center justify-content-center flex-column">
              {!accountConnected ? (
                <div className="not-connected d-flex align-items-center justify-content-center flex-column">
                  <img
                    className="wallet-icons"
                    src={assetRootPath('/images/wallet-icons.svg')}
                  />
                  <h3>
                    {fbt(
                      'Connect a cryptowallet to see your compensation',
                      'Connect a cryptowallet to see your compensation'
                    )}
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={async () => loginConnect()}
                  >
                    {fbt('Connect', 'Connect')}
                  </button>
                </div>
              ) : compensationData ? (
                <>
                  <div className="eligible-text">
                    <p>
                      {fbt(
                        'Eligible OUSD Balance',
                        'Eligible OUSD balance title'
                      )}
                    </p>
                    <h1>{formatCurrency(eligibleOusdBalance)}</h1>
                  </div>
                  <div className="widget-message mt-auto w-100">
                    <p>
                      {fbt(
                        'Compensation for 100% of this OUSD balance is split 25/75 after the first 1,000 OUSD',
                        'Compensation strategy notice'
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <h1 className="not-eligible-text">
                  {fbt(
                    'This wallet is not eligible for compensation',
                    'This wallet is not eligible for compensation'
                  )}
                </h1>
              )}
            </div>
            <div
              className={`ousd-widget col-md-6 d-flex align-items-center flex-column ${
                !accountConnected ? 'big-top-widget' : ''
              } ${ousdClaimed ? 'claimed' : ''}`}
            >
              <img
                className="ousd-coin"
                src={assetRootPath('/images/ousd-coin-big.svg')}
              />
              <div className="widget-title bold-text">
                {fbt('OUSD Compensation Amount', 'OUSD Compensation Amount')}
              </div>
              {accountConnected &&
              ousdCompensationAmount !== null &&
              ousdCompensationAmount !== 0 ? (
                <>
                  <div className="token-amount">
                    {formatCurrency(ousdCompensationAmount)}
                  </div>
                  {ousdClaimed && <h3>{fbt('CLAIMED', 'CLAIMED')}</h3>}
                  {!ousdClaimed && remainingOUSDCompensation !== 0 && (
                    <>
                      <p>
                        {fbt(
                          'Claim to start earning yield',
                          'Claim to start earning yield'
                        )}
                      </p>
                      <button
                        className="btn btn-primary d-flex justify-content-center"
                        onClick={async (e) => {
                          try {
                            setError(null)
                            const result = await compensationContract.claim(
                              account
                            )
                            setWaitingForTransaction(true)
                            const receipt =
                              await rpcProvider.waitForTransaction(result.hash)
                            // sleep for 3 seconds on development so it is more noticeable
                            if (process.env.NODE_ENV === 'development') {
                              await sleep(3000)
                            }

                            if (receipt.blockNumber) {
                              await queryDataUntilAccountChange()
                            }
                            setWaitingForTransaction(false)
                          } catch (e) {
                            setError(
                              fbt(
                                'Unexpected error happened when claiming OUSD',
                                'Claim ousd error'
                              )
                            )
                            console.error(e)
                            setWaitingForTransaction(false)
                          }
                          await fetchCompensationOUSDBalance()
                        }}
                      >
                        {!waitingForTransaction &&
                          fbt('Claim OUSD', 'Claim OUSD')}
                        {waitingForTransaction && (
                          <SpinningLoadingCircle backgroundColor="1a82ff" />
                        )}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="token-amount">0.00</div>
                </>
              )}
            </div>
            <div
              className={`ogn-widget col-md-6 d-flex align-items-center flex-column${
                accountConnected
                  ? ognClaimed
                    ? ' claimed'
                    : ''
                  : ' big-top-widget'
              }`}
            >
              <img
                className="ogn-coin"
                src={assetRootPath('/images/ogn-coin-big.svg')}
              />
              <div className="widget-title bold-text">
                {fbt('OGN Compensation Amount', 'OGN Compensation Amount')}
              </div>
              {accountConnected &&
              compensationData &&
              ognCompensationAmount !== null &&
              ognCompensationAmount !== 0 ? (
                <>
                  <div className="token-amount">
                    {formatCurrency(ognCompensationAmount)}
                  </div>
                  <div className="price-and-stake d-flex">
                    <p>{fbt('@ OGN price of', '@ OGN price of')} $0.1492</p>
                    <span> | </span>
                    <p>
                      {fbt('Staking duration', 'Staking duration')}:{' '}
                      {stakeOptions.length === 3
                        ? stakeOptions[2].durationInDays
                        : '0'}{' '}
                      days
                    </p>
                  </div>
                  {ognClaimed && <h3>{fbt('CLAIMED', 'CLAIMED')}</h3>}
                  {!ognClaimed && (
                    <>
                      <ClaimStakeModal
                        showModal={showModal}
                        setShowModal={setShowModal}
                        ognCompensationAmount={ognCompensationAmount}
                        compensationData={compensationData}
                      />
                      <button
                        className="btn btn-dark"
                        onClick={async () => setShowModal(true)}
                      >
                        {fbt('Claim & Stake OGN', 'Claim & Stake OGN button')}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="token-amount">0.00</div>
                </>
              )}
              <a
                href="https://medium.com/originprotocol/accruing-value-to-ogn-with-ousd-governance-and-protocol-fees-ef166702bcb8"
                target="_blank"
                rel="noopener noreferrer"
              >
                {fbt('Learn about OGN >', 'Learn about OGN')}
              </a>
            </div>
          </div>
          {/* Enabling the warning again once we are able to fetch pre-hack OUSD wallet balance */}
          {/* <WarningAlert showWarning = {displayAdjustmentWarning} text={fbt('The eligible balance has been adjusted based on your trading activity after the OUSD exploit', 'OUSD compensation trading balances warning notice text')} /> */}
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding: 20px 10px 0px;
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

        .ousd-widget h3 {
          font-family: Lato;
          font-size: 18px;
          font-weight: bold;
          line-height: normal;
          margin: 53px 0 0 0;
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

        .ogn-coin,
        .ousd-coin {
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

        .claimed .widget-title,
        .claimed .price-and-stake {
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

          .ousd-widget,
          .ogn-widget {
            padding: 40px 20px;
            border-radius: 0px;
          }

          .eligible-text {
            padding: 35px 0;
          }

          .ousd-widget .btn,
          .ogn-widget .btn {
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

export default withRpcProvider(withWalletSelectModal(Compensation))
