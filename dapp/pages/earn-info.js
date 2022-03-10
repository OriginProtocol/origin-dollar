import { fbt } from 'fbt-runtime'

import withIsMobile from 'hoc/withIsMobile'

import Closing from 'components/Closing'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import { assetRootPath } from 'utils/image'

export default function Earn({ locale, onLocale }) {
  return (
    <Layout locale={locale}>
      <header>
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container text-center text-lg-left px-lg-0">
          <div className="row">
            <div className="col-12 col-lg-7 d-flex align-items-center">
              <div className="text-container mt-lg-5 pt-lg-3">
                <h1>
                  {fbt(
                    'Earn competitive yields without lifting a finger',
                    'Earn competitive yields without lifting a finger'
                  )}
                </h1>
                <h2 className="main-title">
                  {fbt(
                    'OUSD enables both sophisticated DeFi experts and novice users to passively earn compelling returns.',
                    'OUSD enables both sophisticated DeFi experts and novice users to passively earn compelling returns.'
                  )}
                </h2>
                <div className="d-block">
                  <GetOUSD
                    style={withIsMobile ? { marginTop: 30 } : { marginTop: 60 }}
                    primary
                    zIndex2
                    trackSource="Earn page hero section"
                  />
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-5 text-center d-flex justify-content-lg-end justify-content-center">
              <div className="yield-hero-holder">
                <div className="circle under">
                  <img
                    className="front"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-front-line.svg'
                    )}
                  />
                </div>
                <div className="circle over">
                  <img
                    className="back"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-back-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle2 under">
                  <img
                    className="front"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-front-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle2 over">
                  <img
                    className="back"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-back-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle3 under">
                  <img
                    className="front"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-front-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle3 over">
                  <img
                    className="back"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-back-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle4 under">
                  <img
                    className="front"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-front-line.svg'
                    )}
                  />
                </div>
                <div className="circle circle4 over">
                  <img
                    className="back"
                    src={assetRootPath(
                      '/images/yield-hero-graphic-back-line.svg'
                    )}
                  />
                </div>
                <img
                  src={assetRootPath(
                    '/images/yield-hero-graphic-no-lines-background.svg'
                  )}
                  alt="Increasing yield"
                  className="increasing-filler back"
                />
                <img
                  src={assetRootPath('/images/yield-hero-graphic-no-lines.svg')}
                  alt="Increasing yield"
                  className="increasing-filler front"
                />
                <img
                  src={assetRootPath(
                    '/images/yield-hero-graphic-no-lines-nothing.svg'
                  )}
                  alt="Increasing yield"
                />
              </div>
            </div>
          </div>
          <svg>
            <line x1="0%" y1="0" x2="100%" y2="0" />
          </svg>
          <p className="introduction">
            {fbt(
              'The OUSD smart contract pools capital from all stablecoin depositors, then routes capital to a diversified set of yield-earning strategies. Earnings are automatically converted to OUSD and deposited into your wallet.',
              'The OUSD smart contract pools capital from all stablecoin depositors, then routes capital to a diversified set of yield-earning strategies. Earnings are automatically converted to OUSD and deposited into your wallet.'
            )}
          </p>
          <div className="hangers">
            <svg>
              <line x1="0%" y1="0" x2="100%" y2="0" />
              <line x1="25%" y1="0" x2="25%" y2="13" />
              <line x1="50%" y1="0" x2="50%" y2="13" />
              <line x1="75%" y1="0" x2="75%" y2="13" />
            </svg>
            <div className="d-flex justify-content-center">
              <div className="source">
                <img
                  src={assetRootPath('/images/yield-1-icon-small.svg')}
                  alt="Reward fees"
                />
              </div>
              <div className="source">
                <img
                  src={assetRootPath('/images/yield-2-icon-small.svg')}
                  alt="Trading fees"
                />
              </div>
              <div className="source">
                <img
                  src={assetRootPath('/images/yield-3-icon-small.svg')}
                  alt="Liquidity mining rewards"
                />
              </div>
            </div>
            <div className="d-flex justify-content-center">
              <div className="source label">
                {fbt('Reward Fees', 'Reward Fees')}
              </div>
              <div className="source label">
                {fbt('AMM Trading Fees', 'AMM Trading Fees')}
              </div>
              <div className="source label">
                {fbt('Liquidity Mining Rewards', 'Liquidity Mining Rewards')}
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className="bonus">
        <div className="container text-center px-lg-0">
          <img
            src={assetRootPath('/images/yield-4-icon-small.svg')}
            alt="Origin rewards tokens"
            className="d-block d-lg-inline mb-3 mb-lg-0 mx-auto mr-lg-3"
          />
          {fbt(
            'Plus, earn governance privileges and incentives when you contribute to the protocol.',
            'Plus, earn governance privileges and incentives when you contribute to the protocol.'
          )}
          <div className="label mt-2 mt-lg-0">
            {fbt('Coming Soon', 'Coming Soon')}
          </div>
        </div>
      </section>
      <section className="light">
        <div className="container text-center text-lg-left px-lg-0">
          <div className="row">
            <div className="col-lg-5 text-center order-lg-2 d-flex justify-content-lg-end justify-content-center">
              <img
                src={assetRootPath('/images/yield-1-icon-large.svg')}
                alt="Reward Fees"
                className="category w-sd-116 h-sd-116"
              />
            </div>
            <div className="col-lg-7 d-flex align-items-center order-lg-1 justify-content-lg-start justify-content-center">
              <div className="text-container d-flex flex-column align-items-center align-items-lg-start">
                <h3>{fbt('Reward Fees', 'Reward Fees')}</h3>
                <div className="description">
                  {fbt(
                    'The protocol will route your USDT, USDC, and DAI to proven lending and exchange protocols to achieve optimal ROI on your capital.',
                    'The protocol will route your USDT, USDC, and DAI to proven lending and exchange protocols to achieve optimal ROI on your capital.'
                  )}
                </div>
                <div className="elaboration">
                  {fbt(
                    'Rebalancing occurs weekly, factoring in lending rates, rewards tokens, and diversification.',
                    'Rebalancing occurs weekly, factoring in lending rates, rewards tokens, and diversification.'
                  )}
                </div>
                <div className="d-flex logos">
                  <div className="d-flex flex-column logo align-items-start">
                    <div className="d-flex justify-content-center">
                      <img
                        className="w-sd-103"
                        src={assetRootPath('/images/compound-logo.svg')}
                        alt="Compound logo"
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-column logo align-items-start">
                    <div className="d-flex justify-content-center">
                      <img
                        className="w-sd-62"
                        src={assetRootPath('/images/aave-logo.svg')}
                        alt="Aave logo"
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-column logo align-items-start">
                    <div className="d-flex justify-content-center">
                      <img
                        className="w-sd-78 w-140"
                        src={assetRootPath('/images/convex-color.svg')}
                        alt="convex logo"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-6 text-center">
              <img
                src={assetRootPath('/images/yield-2-icon-large.svg')}
                alt="Lending fees"
                className="category w-sd-116 h-sd-116"
              />
            </div>
            <div className="col-lg-6 d-flex align-items-center justify-content-lg-start justify-content-center">
              <div className="text-container d-flex flex-column align-items-center align-items-lg-start">
                <h3 className="w-lg-300">
                  {fbt(
                    'Automated Market Maker Trading Fees',
                    'Automated Market Maker Trading Fees'
                  )}
                </h3>
                <div className="description">
                  {fbt(
                    'Stablecoin liquidity is supplied to Uniswap and other automated market makers to earn trading fees.',
                    'Stablecoin liquidity is supplied to Uniswap and other automated market makers to earn trading fees.'
                  )}
                </div>
                <div className="elaboration">
                  {fbt(
                    'Impermanent loss is minimized while LP fees and rewards are maximized.',
                    'Impermanent loss is minimized while LP fees and rewards are maximized.'
                  )}
                </div>
                <div className="d-flex logos">
                  <div className="d-flex flex-column logo align-items-start">
                    <div className="d-flex justify-content-center">
                      <img
                        className="w-sd-71"
                        src={assetRootPath('/images/curve-logo.svg')}
                        alt="Curve logo"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-6 text-center order-lg-2">
              <img
                src={assetRootPath('/images/yield-3-icon-large.svg')}
                alt="Liquidity Mining Rewards"
                className="category w-sd-202 h-sd-140"
              />
            </div>
            <div className="col-lg-6 d-flex align-items-center order-lg-1 justify-content-lg-start justify-content-center">
              <div className="text-container d-flex flex-column align-items-center align-items-lg-start">
                <h3>
                  {fbt('Liquidity Mining Rewards', 'Liquidity Mining Rewards')}
                </h3>
                <div className="description">
                  {fbt(
                    'COMP, CRV, CVX and other rewards tokens will be accrued and converted to stablecoins for additional yield.',
                    'COMP, CRV, CVX and other rewards tokens will be accrued and converted to stablecoins for additional yield.'
                  )}
                </div>
                <div className="elaboration">
                  {fbt(
                    "Receive all your yield in OUSD automatically. There's no need to actively manage your DeFi portfolio.",
                    "Receive all your yield in OUSD automatically. There's no need to actively manage your DeFi portfolio."
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="dark compounding">
        <div className="container text-center px-lg-0">
          <h4>
            {fbt('OUSD compounds continuously', 'OUSD compounds continuously')}
          </h4>
          <div className="compounding-summary">
            {fbt(
              'Achieve financial security and create wealth faster than ever before.',
              'Achieve financial security and create wealth faster than ever before.'
            )}
          </div>
          <div className="image-container">
            <h5>
              {fbt(
                'Growth of $10,000 over 2 years',
                'Growth of $10,000 over 2 years'
              )}
            </h5>
            <img
              src={assetRootPath('/images/compound-graph-lg.svg')}
              alt="Compounding graph"
              className="d-none d-lg-block"
            />
            <img
              src={assetRootPath('/images/compound-graph-xs.svg')}
              alt="Compounding graph"
              className="d-lg-none"
            />
            <div className="label">{fbt('Months', 'Months')}</div>
          </div>
        </div>
      </section>
      <section className="closing">
        <div className="container text-center px-lg-0">
          <Closing light />
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #183140;
        }

        header .container {
          color: white;
          padding-top: 30px;
          padding-bottom: 60px;
        }

        h2.main-title {
          opacity: 0.8;
          font-family: Lato;
          font-size: 24px;
          font-weight: normal;
          line-height: 1.25;
          color: #bbc9da;
        }

        header .container p {
          max-width: 300px;
        }

        .yield-hero-holder {
          position: relative;
        }

        .circle {
          position: absolute;
          bottom: 200px;
          left: 50%;
          opacity: 0;
          transform: translate(-50%) rotate(180deg);
          animation: circle-rise 6s linear infinite;
        }

        .circle.over {
          z-index: 4;
        }

        .circle.under {
          z-index: 2;
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

        .circle img {
          left: 50%;
          top: -100%;
          transform: translate(-50%, -100%);
        }

        .circle .back {
          position: absolute;
        }

        .circle .front {
          position: absolute;
        }

        .increasing {
          margin-bottom: 30px;
        }

        .increasing-filler.back {
          position: absolute;
          z-index: 1;
        }

        .increasing-filler.front {
          position: absolute;
          z-index: 3;
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

        header .container .introduction {
          margin: auto;
          max-width: 750px;
          text-align: center;
        }

        svg {
          height: 1px;
          margin: 50px 0 15px;
          width: 100%;
        }

        .hangers svg {
          height: 13px;
          margin: 15px 0 0;
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

        .bonus {
          background-color: #2f424e;
          font-size: 1.125rem;
          line-height: 1.06;
          padding: 25px 0;
          text-align: center;
          opacity: 0.8;
        }

        .bonus .label {
          font-size: 0.8125rem;
          line-height: 1.85;
          opacity: 0.8;
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
          margin-top: 10px;
          font-size: 13px;
          font-weight: normal;
          line-height: 1.85;
          color: #8293a4;
        }

        .logos {
          margin-top: 50px;
        }

        .logos .logo {
          margin-right: 60px;
        }

        .logos .logo div:first-of-type {
          min-height: 80px;
        }

        .logos .label {
          color: #8293a4;
          font-size: 0.625rem;
          line-height: 2.4;
          margin: auto;
          text-align: center;
          opacity: 0.8;
        }

        section.light .row:not(:first-of-type) {
          margin-top: 150px;
        }

        section.light .text-container {
          max-width: 500px;
        }

        h4 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 0.86;
        }

        section.compounding {
          padding-top: 100px;
          padding-bottom: 100px;
        }

        .compounding-summary {
          font-size: 1.125rem;
          line-height: 1.33;
          margin: 20px auto 50px;
          opacity: 0.8;
        }

        .compounding .image-container {
          position: relative;
          margin: auto;
          max-width: 786px;
        }

        .compounding h5 {
          position: absolute;
          color: white;
          font-size: 1.125rem;
          top: 0;
          text-align: center;
          width: 100%;
          opacity: 0.8;
        }

        .compounding img {
          margin-right: 7.5%;
          max-width: 92.5%;
        }

        .compounding .label {
          position: absolute;
          bottom: 12.2%;
          color: #fafbfc;
          font-size: 0.75rem;
          text-align: center;
          width: 100%;
          opacity: 0.8;
        }

        section.closing {
          padding-top: 90px;
          padding-bottom: 100px;
        }

        .w-140 {
          width: 140px;
          max-width: 140px;
        }

        @media (min-width: 993px) {
          .w-lg-300 {
            max-width: 300px;
            width: 300px;
          }
        }

        @media (max-width: 992px) {
          header .container {
            padding-bottom: 60px;
          }

          .container {
            padding-left: 30px;
            padding-right: 30px;
          }

          h1 {
            font-size: 28px;
          }

          h2 {
            font-size: 20px;
            margin-bottom: 0px;
          }

          h3,
          h4,
          h5 {
            font-size: 24px;
          }

          .increasing {
            margin-top: -15px;
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

          .bonus .container {
            max-width: 380px;
          }

          .bonus {
            font-size: 14px;
          }

          .w-sd-116 {
            max-width: 116px;
            width: 116px;
          }

          .w-sd-103 {
            max-width: 103px;
            width: 103px;
          }

          .w-sd-62 {
            max-width: 62px;
            width: 62px;
          }

          .w-sd-66 {
            max-width: 66px;
            width: 66px;
          }

          .h-sd-116 {
            max-height: 116px;
            height: 116px;
          }

          .w-sd-202 {
            max-width: 202px;
            width: 202px;
          }

          .h-sd-140 {
            max-height: 140px;
            height: 140px;
          }

          .w-sd-97 {
            max-width: 97px;
            width: 97px;
          }

          .w-sd-78 {
            max-width: 78px;
            width: 78px;
          }

          .w-sd-71 {
            max-width: 71px;
            width: 71px;
          }

          .logos .logo {
            margin-left: 20px;
            margin-right: 20px;
          }

          section.compounding {
            padding-top: 60px;
            padding-bottom: 60px;
          }

          section.closing {
            padding-top: 60px;
            padding-bottom: 60px;
          }

          h3 {
            max-width: 100%;
          }

          .description {
            opacity: 0.8;
            font-size: 14px;
            max-width: 262px;
          }

          .elaboration {
            font-size: 11px;
            line-height: 1.36;
            max-width: 262px;
          }

          .category {
            height: 200px;
            margin-bottom: 30px;
          }

          .logos {
            justify-content: space-around;
          }

          section.light .text-container {
            max-width: 100%;
          }

          section.light .row:not(:first-of-type) {
            margin-top: 60px;
          }

          .compounding .image-container {
            width: 100%;
          }

          .compounding h5 {
            font-size: 0.875rem;
          }

          .compounding img {
            margin-right: 0;
            max-width: 100%;
          }

          .compounding .label {
            bottom: 20.2%;
            font-size: 0.6875rem;
          }
        }

        @keyframes circle-rise {
          /* need this 0% reset because safari instead of resetting to 0% interpolates to it */
          0% {
            bottom: 158px;
            opacity: 0;
          }
          8% {
            bottom: 158px;
            opacity: 0.8;
          }

          25% {
            opacity: 0.8;
          }

          80% {
            opacity: 0.4;
          }

          99% {
            bottom: 258px;
            opacity: 0;
          }

          100% {
            bottom: 260px;
            opacity: 0;
          }
        }
      `}</style>
    </Layout>
  )
}
