import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import Closing from 'components/Closing'
import EmailForm from 'components/EmailForm'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { getDocsLink } from 'utils/getDocsLink'
import { assetRootPath } from 'utils/image'

const discordURL = process.env.DISCORD_URL
const jobsURL = process.env.JOBS_URL
const githubURL = process.env.GITHUB_URL

const Home = ({ locale, onLocale }) => {
  const ousdInitialValue = 13426.953245
  const [ousdValue, setOusdValue] = useState(ousdInitialValue)
  const apy = useStoreState(ContractStore, (s) => s.apy.apy365 || 0)

  const goodTempo = 10000

  useEffect(() => {
    return animateValue({
      from: ousdInitialValue,
      to:
        parseFloat(ousdInitialValue) +
        (parseFloat(ousdInitialValue) * goodTempo) / 8760, // 8760 hours within a calendar year
      callbackValue: (value) => {
        setOusdValue(formatCurrency(value, 2))
      },
      duration: 3600 * 1000, // animate for 1 hour
      id: 'hero-index-ousd-animation',
    })
  }, [])

  return (
    <Layout locale={locale}>
      <header className="text-white">
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container">
          <div className="hero text-center">
            <div className="circle"></div>
            <div className="circle circle2"></div>
            <div className="circle circle3"></div>
            <div className="circle circle4"></div>
            <img
              src={assetRootPath('/images/coin-waves.svg')}
              alt="Waves"
              className="waves"
            />
            <img
              src={assetRootPath('/images/ousd-coin.svg')}
              alt="OUSD coin"
              className="coin"
            />
            <div className="d-flex flex-column align-items-center">
              <div className="introducing">
                {fbt('Introducing', 'Introducing')}
              </div>
              <div className="ticker-symbol">OUSD</div>
              <h1>
                {fbt(
                  'The first stablecoin that earns a yield while it’s still in your wallet',
                  'The first stablecoin that earns a yield while it’s still in your wallet'
                )}
              </h1>
              <GetOUSD
                style={{ marginTop: 40 }}
                className="mx-auto"
                primary
                zIndex2
                trackSource="Hero section button"
              />
            </div>
          </div>
          <hr />
        </div>
      </header>
      <section className="dark">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container overflowing">
                <div className="current">
                  {fbt('Currently earning', 'Currently earning')}
                </div>
                <div className="rate">
                  {formatCurrency(apy * 100, 2) + '%'} APY
                </div>
                <div className="timeframe">
                  {fbt(
                    'Based on a trailing 365-day calculation',
                    'Based on a trailing 365-day calculation'
                  )}
                </div>
                <h2>
                  {fbt(
                    'Convert your USDT, USDC, and DAI to OUSD to start earning yields immediately',
                    'Convert your USDT, USDC, and DAI to OUSD to start earning yields immediately'
                  )}
                </h2>
              </div>
            </div>
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center order-lg-1 px-0 pr-lg-3">
              <img
                src={assetRootPath('/images/3-up-graphic.svg')}
                alt="Three tokens become one"
              />
            </div>
          </div>
        </div>
      </section>
      <section className="light">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center pl-md-0">
              <div className="text-container mb-md-4">
                <h3 className="w-lg-300">
                  {fbt(
                    'All the earnings, none of the hassles',
                    'All the earnings, none of the hassles'
                  )}
                </h3>
                <p className="w-lg-330">
                  {fbt(
                    'DeFi yields are automatically converted to OUSD and accrue in your wallet. Your OUSD balance compounds multiple times per day. No staking or lock-ups are required.',
                    'DeFi yields are automatically converted to OUSD and accrue in your wallet. Your OUSD balance compounds multiple times per day. No staking or lock-ups are required.'
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center overflowing2">
              <img
                src={assetRootPath('/images/earnings-graphic.svg')}
                alt="Earnings"
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container overflowing">
                <h3 className="w-lg-300">
                  {fbt(
                    'Spend your OUSD with ease',
                    'Spend your OUSD with ease'
                  )}
                </h3>
                <p className="w-lg-380">
                  {fbt(
                    "There's no need to unwind complicated positions when you want to spend your OUSD. Transfer OUSD without having to unstake or unlock capital.",
                    "There's no need to unwind complicated positions when you want to spend your OUSD. Transfer OUSD without having to unstake or unlock capital."
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center order-lg-1 overflowing-left">
              <img
                src={assetRootPath('/images/spend-graphic.svg')}
                alt="Spend"
              />
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4 className="w-lg-250">
                  {fbt(
                    'Elastic supply, stable price',
                    'Elastic supply, stable price'
                  )}
                </h4>
                <p>
                  {fbt(
                    'OUSD is pegged to the US Dollar. Returns are distributed as additional units of OUSD. See your OUSD grow much faster than your USD grows in traditional savings accounts.',
                    'OUSD is pegged to the US Dollar. Returns are distributed as additional units of OUSD. See your OUSD grow much faster than your USD grows in traditional savings accounts.'
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img
                src={assetRootPath('/images/ousd-coin.svg')}
                alt="OUSD coin"
                className="ousd-coin"
              />
              <div className="big-text">{ousdValue.toString()}</div>
              <div className="big-text mt-1">OUSD</div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <h4>
                  {fbt(
                    '1:1 backed by other stablecoins',
                    '1:1 backed by other stablecoins'
                  )}
                </h4>
                <p>
                  {fbt(
                    'OUSD is secured by other proven stablecoins like USDT, USDC, and DAI. Capital is further insured by governance tokens issued by platforms like Aave and MakerDAO.',
                    'OUSD is secured by other proven stablecoins like USDT, USDC, and DAI. Capital is further insured by governance tokens issued by platforms like Aave and MakerDAO.'
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center align-items-lg-start justify-content-center order-lg-1">
              <img
                className="ml-lg-5 w-sd-270"
                src={assetRootPath('/images/backed-graphic.svg')}
                alt="Backed"
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>
                  {fbt('Automated yield farming', 'Automated yield farming')}
                </h4>
                <p>
                  {fbt(
                    'Automated strategies in transparent OUSD smart contracts manage your funds. See exactly how your money is being put to work.',
                    'Automated strategies in transparent OUSD smart contracts manage your funds. See exactly how your money is being put to work.'
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center">
              <img
                className="w-sd-270"
                src={assetRootPath('/images/automatic-graphic.svg')}
                alt="Automatic"
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <h4 className="w-lg-240">
                  {fbt(
                    'You always have full control',
                    'You always have full control'
                  )}
                </h4>
                <p>
                  {fbt(
                    "Store and earn OUSD with non-custodial Ethereum wallets. Enter and exit OUSD whenever you want. There's no minimum holding period or minimum OUSD amount required to earn yields.",
                    "Store and earn OUSD with non-custodial Ethereum wallets. Enter and exit OUSD whenever you want. There's no minimum holding period or minimum OUSD amount required to earn yields."
                  )}
                </p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center align-items-lg-start justify-content-center order-lg-1">
              <img
                className="ml-md-4 w-sd-270"
                src={assetRootPath('/images/control-graphic.svg')}
                alt="Control"
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>
                  {fbt(
                    'Backed by optional insurance',
                    'Backed by optional insurance'
                  )}
                </h4>
                <p>
                  {fbt(
                    'Protect your OUSD holdings with smart contract insurance. Optional coverage is provided by Nexus Mutual and InsurAce.',
                    'Protect your OUSD holdings with smart contract insurance. Optional coverage is provided by Nexus Mutual and InsurAce.'
                  )}
                </p>
                <a
                  href="https://docs.ousd.com/security-and-risks/insurance"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {fbt('Learn more >', 'Learn more >')}
                </a>
              </div>
            </div>
            <div className="col-lg-6 d-flex flex-column align-items-center justify-content-center">
              <img
                className="insurance-img w-sd-270"
                src={assetRootPath('/images/ousd-shield-blue-icon.svg')}
                alt="Automatic"
              />
            </div>
          </div>
        </div>
      </section>
      <section className="dark pb-100 work-in-progress">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>{fbt('Exchanges and partners', 'Exchanges and partners')}</h5>
            <p className="exchanges-summary">
              {fbt(
                'Use the Dapp to get the best price when swapping to & from OUSD. The Dapp checks costs of the swap on external exchanges as well as our Vault contract and picks the best price for you. You can also trade OUSD directly from our partners & exchanges.',
                'Where to get OUSD explanation text'
              )}
            </p>
            <div className="d-flex justify-content-center flex-wrap">
              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open(
                    'https://www.kucoin.com/trade/OUSD-USDT',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="kucoin-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/kucoin-color.svg')} />
                </div>
                <div>{fbt('KuCoin', 'KuCoin')}</div>
              </div>

              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open(
                    'https://app.uniswap.org/#/swap?inputCurrency=0x2a8e1e676ec238d8a992307b495b45b3feaa5e86&outputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7&chain=mainnet',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="uniswap-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/uniswap.svg')} />
                </div>
                <div>{fbt('Uniswap', 'Uniswap')}</div>
              </div>

              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open(
                    'https://curve.fi/factory/9',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="curve-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/curve-color.png')} />
                </div>
                <div>{fbt('Curve', 'Curve')}</div>
              </div>
              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open(
                    'https://www.gate.io/trade/OUSD_USDT',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="gateio-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/gete_io.png')} />
                </div>
                <div>gate.io</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="light perfection perfect-stable-coin">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>
              {fbt(
                'The perfect stablecoin for both spending and saving',
                'The perfect stablecoin for both spending and saving'
              )}
            </h5>
          </div>
          <div className="row">
            <div className="col-6 col-md-4 ml-auto text-center">
              <div className="image-container">
                <img
                  src={assetRootPath('/images/savings-icon.svg')}
                  alt="Savings icon"
                />
              </div>
              <h6>
                {fbt(
                  'Beat traditional savings and money markets',
                  'Beat traditional savings and money markets'
                )}
              </h6>
              <p>
                {fbt(
                  `At an estimated APY of ${fbt.param(
                    'current-apy',
                    formatCurrency(apy * 100, 2) + '%'
                  )}, OUSD earnings trounce traditional financial instruments.`,
                  'At estimated APYs over X, OUSD earnings trounce traditional financial instruments.'
                )}
              </p>
            </div>
            <div className="col-6 col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img
                  src={assetRootPath('/images/transfer-icon.svg')}
                  alt="Transfer icon"
                />
              </div>
              <h6>
                {fbt(
                  'Instantaneous peer-to-peer transfers',
                  'Instantaneous peer-to-peer transfers'
                )}
              </h6>
              <p>
                {fbt(
                  'Send OUSD to pay your friends and family instead of using Venmo or Paypal. They’ll earn yield immediately.',
                  'Send OUSD to pay your friends and family instead of using Venmo or Paypal. They’ll earn yield immediately.'
                )}
              </p>
            </div>
          </div>
          <div className="row">
            <div className="col-6 col-md-4 ml-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img
                  src={assetRootPath('/images/remittances-icon.svg')}
                  alt="Remittances icon"
                />
              </div>
              <h6>
                {fbt('Remittances without fees', 'Remittances without fees')}
              </h6>
              <p>
                {fbt(
                  'Need to send money to China or the Philippines? Your recipients get OUSD without losing the average of 6.7% on fees.',
                  'Need to send money to China or the Philippines? Your recipients get OUSD without losing the average of 6.7% on fees.'
                )}
              </p>
            </div>
            <div className="col-6 col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img
                  src={assetRootPath('/images/account-icon.svg')}
                  alt="Account icon"
                />
              </div>
              <h6>
                {fbt('A better unit of account', 'A better unit of account')}
              </h6>
              <p>
                {fbt(
                  'Easily track your DeFi earnings without complicated spreadsheets and custom dashboards.',
                  'Easily track your DeFi earnings without complicated spreadsheets and custom dashboards.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="dark pb-100 work-in-progress">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>{fbt('Audited and Verified', 'Audited and Verified')}</h5>
            <p className="exchanges-summary">
              {fbt(
                'OUSD has been audited by multiple, well-respected security firms.',
                'OUSD has been audited by multiple, well-respected security firms.'
              )}
            </p>
            <div className="d-flex justify-content-center flex-wrap">
              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open(
                    'https://www.trailofbits.com/',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="trailofbits-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img
                    src={assetRootPath('/images/logos/trail-of-bits-white.svg')}
                  />
                </div>
                <div>{fbt('Trail of bits', 'Trail of bits')}</div>
              </div>

              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open('https://www.certora.com/', '_blank', 'noopener')
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/certora.png')} />
                </div>
                <div>{fbt('Certora', 'Certora')}</div>
              </div>

              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open('https://solidified.io/', '_blank', 'noopener')
                }}
              >
                <div className="solidified-box info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJoLWZ1bGwiIHZpZXdCb3g9IjAgMCAzOCA0OCI+DQogICAgPGRlZnM+DQogICAgICA8bGluZWFyR3JhZGllbnQNCiAgICAgICAgaWQ9Im80anc0bzd2cGEiDQogICAgICAgIHgxPSIxMDAlIg0KICAgICAgICB4Mj0iMTIuMTg0JSINCiAgICAgICAgeTE9IjAlIg0KICAgICAgICB5Mj0iODYuNzc3JSINCiAgICAgID4NCiAgICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzhGQ0Y0QSIgLz4NCiAgICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMEFGIiAvPg0KICAgICAgPC9saW5lYXJHcmFkaWVudD4NCiAgICA8L2RlZnM+DQogICAgPGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4NCiAgICAgIDxwYXRoDQogICAgICAgIGZpbGw9InVybCgjbzRqdzRvN3ZwYSkiDQogICAgICAgIGQ9Ik0yOC41IDI0djQuOGMwIDUuMzAyLTQuMjUzIDkuNi05LjUgOS42cy05LjUtNC4yOTgtOS41LTkuNlY5LjZoMTlWMjR6Ig0KICAgICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTI5MCAtMjYpIHRyYW5zbGF0ZSgxMjkwIDI2KSINCiAgICAgIC8+DQogICAgICA8cGF0aA0KICAgICAgICBmaWxsPSIjRkZGIg0KICAgICAgICBkPSJNMzggMTkuMnY5LjZDMzggMzkuNDA0IDI5LjQ5MyA0OCAxOSA0OCA5LjI4NyA0OCAxLjI3NiA0MC42MzUuMTM4IDMxLjEzTDQuNzUgMjguOHYxLjZoLjAxMkM1LjA3MyAzNy43NjggMTEuMzMgNDMuNjQ4IDE5IDQzLjY0OGM3LjY3MSAwIDEzLjkyNy01Ljg4IDE0LjIzOC0xMy4yNDhoLjAxMlYyNEgwVjBoMzh2MTJsLTQuNzUgMi40VjQuOEg0Ljc1djE0LjRIMzh6Ig0KICAgICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTI5MCAtMjYpIHRyYW5zbGF0ZSgxMjkwIDI2KSINCiAgICAgIC8+DQogICAgPC9nPg0KICA8L3N2Zz4="
                    alt="Solidified logo"
                  />
                </div>
                <div>{fbt('Solidified', 'Solidified')}</div>
              </div>

              <div
                className="info-box-holder d-flex flex-column"
                onClick={() => {
                  window.open('https://openzeppelin.com/', '_blank', 'noopener')
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/openZepplin.png')} />
                </div>
                <div>{fbt('OpenZeppelin', 'OpenZeppelin')}</div>
              </div>
            </div>
            <p className="exchanges-summary top-margin">
              {fbt(
                'Protocol security remains top priority',
                'Protocol security remains top priority'
              )}
            </p>
            <div className="d-flex justify-content-center flex-wrap">
              <div
                className="info-box-holder d-flex flex-column align-items-center"
                onClick={() => {
                  window.open(
                    'https://docs.ousd.com/governance/admin-privileges#admin',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/contract-icon.svg')} />
                </div>
                <div className="info-box-text">
                  {fbt(
                    '5 (of 8) signatures required for any admin changes',
                    '5 (of 8) signatures required for any admin changes'
                  )}
                </div>
              </div>

              <div
                className="info-box-holder d-flex flex-column align-items-center"
                onClick={() => {
                  window.open(
                    'https://docs.ousd.com/governance/admin-privileges#admin',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/timelock-icon.svg')} />
                </div>
                <div className="info-box-text">
                  {fbt(
                    '48 hour time delay before changes come into affect',
                    '48 hour time delay before changes come into affect'
                  )}
                </div>
              </div>

              <div
                className="info-box-holder d-flex flex-column align-items-center"
                onClick={() => {
                  window.open('https://nexusmutual.io/', '_blank', 'noopener')
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/nexusMutual.jpeg')} />
                </div>
                <div className="info-box-text">
                  {fbt('Nexus mutual insurance', 'Nexus mutual insurance')}
                </div>
              </div>

              <div
                className="info-box-holder d-flex flex-column align-items-center"
                onClick={() => {
                  window.open('https://www.insurace.io/', '_blank', 'noopener')
                }}
              >
                <div className="info-box d-flex justify-content-center align-items-center mb-2 mx-3">
                  <img src={assetRootPath('/images/logos/insureAce.png')} />
                </div>
                <div className="info-box-text">
                  {fbt('InsurAce insurance', 'InsurAce insurance')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="follow-development">
        <div className="container text-center">
          <h5>{fbt('Follow our development', 'Follow our development')}</h5>
          <div className="d-flex community-buttons flex-column flex-lg-row justify-content-center">
            <a
              href={discordURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light d-flex align-items-center justify-content-center"
            >
              <img
                src={assetRootPath('/images/discord-icon.svg')}
                alt="Discord logo"
              />
              &nbsp;{fbt('Join us on Discord', 'Join us on Discord')}
            </a>
            <a
              href={githubURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light d-flex align-items-center justify-content-center"
            >
              <img
                src={assetRootPath('/images/github-icon.svg')}
                alt="GitHub logo"
              />
              &nbsp;{fbt('Check out our GitHub', 'Check out our GitHub')}
            </a>
            <a
              href={getDocsLink(locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light d-flex align-items-center justify-content-center"
            >
              <img
                src={assetRootPath('/images/docs-icon.svg')}
                alt="Docs icon"
              />
              &nbsp;{fbt('View the documentation', 'View the documentation')}
            </a>
          </div>
          <Closing light />
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #183140;
        }

        hr {
          border-top: solid 1px #8293a4;
          margin: 110px -15px 0 -15px;
        }

        .waves {
          position: absolute;
          top: 0;
          transform: translate(-50%);
          z-index: 0;
        }

        .coin {
          position: absolute;
          top: 230px;
          transform: translate(-50%);
          z-index: 2;
        }

        .circle {
          position: absolute;
          top: 240px;
          left: 50%;
          transform: translate(-50%);
          z-index: 1;
          border: 1px solid white;
          border-radius: 305px;
          animation: circle-grow 6s linear infinite;
        }

        .circle2 {
          animation-delay: 2s;
        }

        .circle3 {
          animation-delay: 4s;
        }

        .circle4 {
          animation-delay: 6s;
        }

        .introducing {
          font-size: 1.5rem;
          margin-top: 70px;
          opacity: 0.8;
        }

        .ticker-symbol {
          font-family: Poppins;
          font-size: 4rem;
          font-weight: 500;
          margin-top: 206px;
        }

        h1 {
          margin-top: 28px;
          font-family: Lato;
          font-size: 2rem;
        }

        .current {
          font-size: 1.5rem;
          opacity: 0.8;
        }

        .timeframe {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .rate {
          font-family: Poppins;
          font-size: 4rem;
          line-height: 1;
        }

        .disclaimer {
          font-size: 0.875rem;
          opacity: 0.8;
        }

        h2 {
          font-size: 1.5rem;
          margin-top: 20px;
          opacity: 0.8;
        }

        h3,
        h4 {
          font-family: Poppins;
          font-size: 1,75rem;
          font-weight: 500;
          line-height: 1.32;
        }

        p {
          margin: 20px 0 0;
          font-size: 1.125rem;
          line-height: 1.33;
          opacity: 0.8;
        }

        .row .text-container {
          max-width: 420px;
        }

        .row .text-container.overflowing {
          max-width: 435px;
        }

        .row .insurance-img {
          margin: -150px 0;
        }

        .overflowing {
          margin-right: -30px;
          margin-left: 30px;
        }

        .overflowing2 {
          margin-right: -60px;
          margin-left: 60px;
        }

        .overflowing-left {
          margin-left: -30px;
          margin-right: 30px;
        }

        .row:not(:first-of-type) {
          margin-top: 100px;
        }

        h5 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 1.32;
        }

        .exchanges-summary {
          max-width: 740px;
          margin-bottom: 50px;
        }

        .exchanges-summary.top-margin {
          margin-top: 50px;
        }

        .logos {
          margin-top: 80px;
          justify-content: space-evenly;
          display: flex;
          width: 100%;
          align-items: center;
        }

        .email-cta {
          max-width: 460px;
        }

        section.dark {
          padding: 113px 40px 140px 40px;
        }

        .dark .btn {
          border-radius: 25px;
          border: solid 1px #ffffff;
          font-size: 1.125rem;
          font-weight: bold;
        }

        .meet-team, .view-jobs {
          margin-top: 80px;
          min-width: 201px;
          min-height: 50px;
        }

        .view-jobs {
          width: fit-content;
        }

        .form-container, .hiring {
          border-top: solid 1px #8293a4;
          margin-top: 80px;
          padding-top: 80px;
          width: 100%;
        }

        h6 {
          margin-top: 30px;
          font-size: 1.125rem;
          line-height: 1.33;
          color: #183140;
        }

        .image-container {
          height: 96px;
        }

        .community-buttons {
          border-bottom: solid 1px #7bb7ff;
          margin: 50px 0 80px;
          padding-bottom: 80px;
        }

        .community-buttons .btn {
          min-width: 281px;
          min-height: 50px;
          border-radius: 25px;
          border: solid 1px #ffffff;
        }

        .community-buttons .btn:not(:last-of-type) {
          margin-right: 20px;
        }

        .community-buttons .btn img {
          margin-right: 10px;
        }

        .hero div {
          z-index: 1;
        }

        .hero h1 {
          max-width: 520px;
          z-index: 1;
        }

        .light h3 {
          max-width: 330px;
        }

        .big-text {
          font-size: 48px;
          font-weight: 500;
          line-height: 1.04;
          text-align: center;
          color: white;
          font-family: Lato;
          font-weight: 600;
        }

        .ousd-coin {
          width: 140px;
          height: 140px;
          margin-bottom: 15px;
        }

        .pb-100 {
          padding-bottom: 100px !important;
        }

        .perfect-stable-coin {
          padding: 90px 40px 105px 40px;
        }

        .perfect-stable-coin .row {
          margin-top: 70px;
        }

        .follow-development {
          padding-top: 80px;
          padding-bottom: 80px;
        }

        .info-box {
          background-color: #eeeeee;
          border-radius: 10px;
          min-height: 170px;
          min-width: 170px;
          color: black;
        }

        .info-box img {
          min-width: 150px;
          max-width: 150px;
          max-height: 150px;
        }

        .info-box-text {
          max-width: 150px;
          text-align: center;
        }

        .curve-box {
          background-color: #a5a4ce;
        }

        .kucoin-box,
        .gateio-box,
        .uniswap-box {
          background-color: #ffffff;
        }

        .kucoin-box img {
          margin: 10px;
        }

        .info-box-holder {
          cursor: pointer;
        }

        .info-box-holder:hover {
          opacity: 0.7;
        }

        .trailofbits-box {
          background-color: #1f2023;
        }

        .solidified-box {
          background-color: #242739;
        }
        
        @media (min-width: 993px) {
          .w-lg-240 {
            max-width: 240px;
            width: 240px;
          }

          .w-lg-250 {
            max-width: 250px;
            width: 250px;
          }

          .w-lg-300 {
            max-width: 300px;
            width: 300px;
          }

          .w-lg-330 {
            max-width: 330px;
            width: 330px;
          }

          .w-lg-380 {
            max-width: 380px;
            width: 380px;
          }
        }

        @media (max-width: 992px) {
          header {
            padding-bottom: 0px;
          }

          section.dark {
            padding: 47px 30px 54px 30px;
          }

          section.dark .container {
            padding-left: 0px;
            padding-right: 0px;
          }

          .w-sd-270 {
            max-width: 270px;
            width: 270px;
          }

          p {
            margin: 16px 0 0;
            font-size: 14px;
            line-height: 1.36;
            opacity: 0.8;
          }

          .overflowing {
            margin-right: 0px;
            margin-left: 0px;
          }

          .overflowing2 {
            margin-right: 0px;
            margin-left: 0px;
          }

          .overflowing-left {
            margin-left: 0px;
            margin-right: 0px;
          }

          h3, h4, h5 {
            font-size: 1.5rem;
          }

          section.dark .container h2 {
            font-size: 18px;
          }

          .rate {
            font-size: 59px;
          }

          .perfect-stable-coin {
            padding: 60px 30px 57px 30px;
          }

          .perfection.perfect-stable-coin h6 {
            margin-top: 16px;
          }

          .follow-development {
            padding-top: 50px;
            padding-bottom: 66px;
          }

          .introducing {
            font-size: 1.5rem;
            margin-top: 25px;
            opacity: 0.8;
          }

          .hero h1 {
            font-size: 22px;
          }

          .container {
            padding-left: 30px;
            padding-right: 30px;
          }

          hr {
            margin-top: 50px;
          }

          section {
            padding: 50px 0 60px;
          }

          .light h3 {
            margin: auto;
          }

          .row .text-container {
            margin-bottom: 50px;
            text-align: center;
          }

          .row .insurance-img {
            margin: -70px 0 -10px 0;
          }

          img:not(.waves) {
            max-width: 100%;
          }

          .logos {
            margin-top: 40px;
          }

          .logos img {
            max-height: calc(100vw * 0.04);
          }

          .perfection .container {
            padding-left: 0px;
            padding-right: 0px;
          }

          .meet-team, .view-jobs {
            margin-top: 50px;
            width: 100%;
          }

          .perfection h6,
          .perfection p {
            font-size: 0.6875rem;
            margin: 10px auto 0;
            max-width: 160px;
          }

          .perfection .row:not(:first-of-type) {
            margin-top: 40px;
          }

          .community-buttons {
            padding-bottom: 40px;
          }

          .community-buttons .btn {
            margin-bottom: 20px;
            margin-left: 0;
            width: 100%;
          }

          .row .text-container.overflowing {
            max-width: auto;
          }

          .row .overflowing {
            margin-right: 0px;
            margin-left: 0px;
          }

          .overflowing2 {
            margin-right: 0px;
            margin-left: 0px;
          }

          .info-box-holder {
            margin-bottom: 40px;
          }
        }

        @keyframes circle-grow {
          /* need this 0% reset because safari instead of resetting to 0% interpolates to it */
          0% {
            width: 100px;
            height: 100px;
            border-radius: 303px
            top: 240px;
            opacity: 0;
          }
          1% {
            width: 140px;
            height: 140px;
            border-radius: 70px
            top: 230px;
            opacity: 0.1;
          }

          90% {
            opacity: 0.1;
            width: 559px;
            height: 559px;
          }

          100% {
            width: 605px;
            height: 605px;
            border-radius: 303px
            top: 0px;
            opacity: 0;
          }
        }

      `}</style>
    </Layout>
  )
}

export default Home
