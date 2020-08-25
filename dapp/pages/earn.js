import { fbt } from 'fbt-runtime'

import Closing from 'components/Closing'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'

export default function Earn({ locale, onLocale }) {
  return (
    <Layout>
      <header>
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container text-center text-lg-left">
          <div className="row">
            <div className="col-12 col-lg-7 d-flex align-items-center">
              <div className="text-container">
                <h1>{fbt('Earn highly competitive yields without lifting a finger', 'Earn highly competitive yields without lifting a finger')}</h1>
                <h2>{fbt('OUSD enables both sophisticated DeFi experts and novice users to passively earn compelling returns across four strategies.', 'OUSD enables both sophisticated DeFi experts and novice users to passively earn compelling returns across four strategies.')}</h2>
                <div className="d-none d-lg-block">
                  <GetOUSD style={{ marginTop: 60 }} dark />
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-5 text-center">
              <img src="/images/yield-hero-graphic.svg" alt="Increasing yield" loading="lazy" className="increasing" />
              <p className="mx-auto">{fbt('View the documentation', 'View the documentation')}</p>
            </div>
          </div>
          <div className="hangers">
            <svg>
              <line x1="0%" y1="0" x2="100%" y2="0" />
              <line x1="12.5%" y1="0" x2="12.5%" y2="13" />
              <line x1="37.5%" y1="0" x2="37.5%" y2="13" />
              <line x1="62.5%" y1="0" x2="62.5%" y2="13" />
              <line x1="87.5%" y1="0" x2="87.5%" y2="13" />
            </svg>
            <div className="d-flex">
              <div className="source">
                <img src="/images/yield-1-icon-small.svg" alt="Lending fees" loading="lazy" />
              </div>
              <div className="source">
                <img src="/images/yield-2-icon-small.svg" alt="Trading fees" loading="lazy" />
              </div>
              <div className="source">
                <img src="/images/yield-3-icon-small.svg" alt="Liquidity mining rewards" loading="lazy" />
              </div>
              <div className="source">
                <img src="/images/yield-4-icon-small.svg" alt="Origin Token rewards" loading="lazy" />
              </div>
            </div>
            <div className="d-flex">
              <div className="source label">{fbt('Lending Fees', 'Lending Fees')}</div>
              <div className="source label">{fbt('AMM Trading Fees', 'AMM Trading Fees')}</div>
              <div className="source label">{fbt('Liquidity Mining Rewards', 'Liquidity Mining Rewards')}</div>
              <div className="source label">{fbt('Origin Token Rewards', 'Origin Token Rewards')}</div>
            </div>
          </div>
        </div>
      </header>
      <section className="light">
        <div className="container text-center text-lg-left">
          <div className="row">
            <div className="col-lg-5 text-center order-lg-2">
              <img src="/images/yield-1-icon-large.svg" alt="Lending fees" loading="lazy" className="category" />
            </div>
            <div className="col-lg-7 d-flex align-items-center order-lg-1">
              <div className="text-container">
                <h3>{fbt('Lending Fees', 'Lending Fees')}</h3>
                <div className="description">{fbt('We route your USDT, USDC, and DAI to proven lending protocols to achieve optimal ROI on your capital.', 'We route your USDT, USDC, and DAI to proven lending protocols to achieve optimal ROI on your capital.')}</div>
                <div className="elaboration">{fbt('Rebalancing occurs often, factoring in lending rates, rewards tokens, and diversification.', 'Rebalancing occurs often, factoring in lending rates, rewards tokens, and diversification.')}</div>
                <div className="d-flex logos">
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/compound-logo.svg" alt="Compound logo" loading="lazy" />
                    </div>
                    <div className="label text-white">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/aave-logo.svg" alt="Aave logo" loading="lazy" />
                    </div>
                    <div className="label">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/dydx-logo.svg" alt="dy/dx logo" loading="lazy" />
                    </div>
                    <div className="label">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 text-center">
              <img src="/images/yield-2-icon-large.svg" alt="Lending fees" loading="lazy" className="category" />
            </div>
            <div className="col-lg-7 d-flex align-items-center">
              <div className="text-container">
                <h3>{fbt('Automated Market Maker Trading Fees', 'Automated Market Maker Trading Fees')}</h3>
                <div className="description">{fbt('Origin supplies stablecoin liquidity to Uniswap and other AMM platforms to earn trading fees.', 'Origin supplies stablecoin liquidity to Uniswap and other AMM platforms to earn trading fees.')}</div>
                <div className="elaboration">{fbt('Impermanent loss is minimized while LP fees and rewards are maximized.', 'Impermanent loss is minimized while LP fees and rewards are maximized.')}</div>
                <div className="d-flex logos">
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/uniswap-logo.svg" alt="Uniswap logo" loading="lazy" />
                    </div>
                    <div className="label">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/balancer-logo.svg" alt="Balancer logo" loading="lazy" />
                    </div>
                    <div className="label">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                  <div className="d-flex flex-column logo">
                    <div className="flex-fill d-flex justify-content-center">
                      <img src="/images/curve-logo.svg" alt="Curve logo" loading="lazy" />
                    </div>
                    <div className="label">{fbt('Coming Soon', 'Coming Soon')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 text-center order-lg-2">
              <img src="/images/yield-3-icon-large.svg" alt="Lending fees" loading="lazy" className="category" />
            </div>
            <div className="col-lg-7 d-flex align-items-center order-lg-1">
              <div className="text-container">
                <h3>{fbt('Liquidity Mining Rewards', 'Liquidity Mining Rewards')}</h3>
                <div className="description">{fbt('COMP, BAL, CRV, and other rewards tokens earned on lending and AMM platforms are accrued and liquidated for additional yield.', 'COMP, BAL, CRV, and other rewards tokens earned on lending and AMM platforms are accrued and liquidated for additional yield.')}</div>
                <div className="elaboration">{fbt('Receive all your yield in OUSD automatically. There\'s no need to manage your DeFi portfolio.', 'Receive all your yield in OUSD automatically. There\'s no need to manage your DeFi portfolio.')}</div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 text-center">
              <img src="/images/yield-4-icon-large.svg" alt="Lending fees" loading="lazy" className="category" />
            </div>
            <div className="col-lg-7 d-flex align-items-center">
              <div className="text-container">
                <h3>{fbt('Origin Rewards Token', 'Origin Rewards Token')}</h3>
                <div className="description">{fbt('Earn additional yield from Origin when you deposit stablecoins and convert them to OUSD.', 'Earn additional yield from Origin when you deposit stablecoins and convert them to OUSD.')}</div>
                <div className="elaboration">{fbt('OUSD users will be rewarded with the platform\'s governance token.', 'OUSD users will be rewarded with the platform\'s governance token.')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container text-center">
          <Closing />
        </div>
      </section>
      <style jsx>{`
        header .container {
          color: white;
          padding-top: 80px;
          padding-bottom: 140px;
        }

        header .container p {
          max-width: 300px;
        }

        h1 {
          font-family: Poppins;
          font-size: 2.125rem;
          font-weight: 500;
        }

        h2 {
          font-family: Lato;
          font-size: 1.5rem;
          line-height: 1.25;
          margin-top: 30px;
          opacity: 0.8;
        }

        p {
          font-size: 0.8125rem;
          line-height: 1.46;
          margin-bottom: 0;
          opacity: 0.8;
        }

        .increasing {
          margin-bottom: 30px;
        }

        .hangers {
          margin-top: 50px;
        }

        svg {
          height: 13px;
          width: 100%;
        }

        line {
          stroke: rgb(234, 243, 234);
          stroke-width: 1;
        }

        .source {
          margin-top: 45px;
          text-align: center;
          width: 25%;
          font-size: 0.8125rem;
          line-height: 1.46;
        }

        .source.label {
          opacity: 0.8;
        }

        .source img {
          max-height: 100%;
        }

        h3 {
          color: black;
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 1.32;
          max-width: 400px;
        }

        .description {
          color: black;
          font-size: 1.125rem;
          line-height: 1.33;
          margin-top: 30px;
        }

        .elaboration {
          color: #8293a4;
          margin-top: 10px;
        }

        .logos {
          margin-top: 50px;
        }

        .logos .logo {
          margin-right: 60px;
        }

        .logos .label {
          color: #8293a4;
          font-size: 0.625rem;
          line-height: 2.4;
          margin-top: 20px;
          text-align: center;
          opacity: 0.8;
        }

        section.light .row:not(:first-of-type) {
          margin-top: 150px;
        }

        section.light .text-container {
          max-width: 500px;
        }

        @media (max-width: 992px) {
          header .container {
            padding-bottom: 60px;
          }

          .increasing {
            margin-top: 40px;
          }

          .source {
            margin-top: calc(15vw / 3);
          }

          .source img {
            height: 15vw;
          }

          section {
            padding: 60px 0;
          }

          .category {
            height: 200px;
            margin-bottom: 30px;
          }

          .logos {
            justify-content: space-around;
          }

          .logos .logo {
            margin-right: 0;
          }

          section.light .row:not(:first-of-type) {
            margin-top: 60px;
          }
        }
      `}</style>
    </Layout>
  )
}
