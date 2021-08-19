import { fbt } from 'fbt-runtime'

import Closing from 'components/Closing'
import Layout from 'components/layout'
import Nav from 'components/Nav'

export default function Governance({ locale, onLocale }) {
  return (
    <Layout locale={locale}>
      <header>
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container d-flex flex-column align-items-center">
          <h1 className="w-lg-520">
            {fbt(
              'The OUSD protocol will be governed by its users',
              'The OUSD protocol will be governed by its users'
            )}
          </h1>
          <h2 className="w-lg-520">
            {fbt(
              'While OUSD’s lead developers and community advocates are currently members of the Origin team, it is our intention to rapidly move towards decentralized governance.',
              'While OUSD’s lead developers and community advocates are currently members of the Origin team, it is our intention to rapidly move towards decentralized governance.'
            )}
          </h2>
          <div className="d-flex mt-4">
            <div className="left" />
            <div className="right" />
          </div>
        </div>
      </header>
      <section>
        <div className="number">1</div>
        <div className="container">
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
          <h3 className="phase">{fbt('Phase 1', 'Phase 1')}</h3>
          <div className="events">
            <div className="left">
              <div className="event-container pb-5 pb-lg-0">
                <div className="event">
                  {fbt(
                    'Origin team and contributors release initial smart contracts, managed by a 5 of 8 multisig with a timelock',
                    'Origin team and contributors release initial smart contracts, managed by a 5 of 8 multisig with a timelock'
                  )}
                </div>
                <svg>
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                  <circle cx="102%" cy="50%" r="3" />
                </svg>
              </div>
              <div className="event-container">
                <div className="event">
                  {fbt(
                    'Initial yield-earning strategies (lending and rewards token collection) are implemented',
                    'Initial yield-earning strategies (lending and rewards token collection) are implemented'
                  )}
                </div>
                <svg>
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                  <circle cx="102%" cy="50%" r="3" />
                </svg>
              </div>
            </div>
            <div className="right">
              <div className="event-container">
                <svg>
                  <circle cx="-1%" cy="50%" r="3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                </svg>
                <div className="event">
                  {fbt(
                    'Smart contracts are audited and stress tested',
                    'Smart contracts are audited and stress tested'
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
        </div>
      </section>
      <section>
        <div className="number">2</div>
        <div className="container">
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
          <h3 className="phase">{fbt('Phase 2', 'Phase 2')}</h3>
          <div className="events">
            <div className="left">
              <div className="event-container pt-5">
                <div className="event">
                  {fbt(
                    'Initial governance privileges and incentives given to users who create value for OUSD',
                    'Initial governance privileges and incentives given to users who create value for OUSD'
                  )}
                </div>
                <svg>
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                  <circle cx="102%" cy="50%" r="3" />
                </svg>
              </div>
            </div>
            <div className="right">
              <div className="event-container pb-5">
                <svg>
                  <circle cx="-1%" cy="50%" r="3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                </svg>
                <div className="event">
                  {fbt(
                    'Origin team and contributors add additional yield-earning strategies (e.g. supplying liquidity to automated market makers)',
                    'Origin team and contributors add additional yield-earning strategies (e.g. supplying liquidity to automated market makers)'
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
        </div>
      </section>
      <section>
        <div className="number">3</div>
        <div className="container">
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
          <h3 className="phase">{fbt('Phase 3', 'Phase 3')}</h3>
          <div className="events">
            <div className="left">
              <div className="event-container">
                <div className="event">
                  {fbt('Further stress testing', 'Further stress testing')}
                </div>
                <svg>
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                  <circle cx="102%" cy="50%" r="3" />
                </svg>
              </div>
            </div>
            <div className="right">
              <div className="event-container pb-2 pb-lg-0">
                <svg>
                  <circle cx="-1%" cy="50%" r="3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                </svg>
                <div className="event">
                  {fbt(
                    'Rollout of audited governance contracts',
                    'Rollout of audited governance contracts'
                  )}
                </div>
              </div>
              <div className="event-container">
                <svg>
                  <circle cx="-1%" cy="50%" r="3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                </svg>
                <div className="event">
                  {fbt(
                    'Continued distribution of governance privileges and incentives to OUSD users',
                    'Continued distribution of governance privileges and incentives to OUSD users'
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
        </div>
      </section>
      <section>
        <div className="number">4</div>
        <div className="container">
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
          <h3 className="phase">{fbt('Phase 4', 'Phase 4')}</h3>
          <div className="events">
            <div className="left">
              <div className="event-container pb-5">
                <div className="event">
                  {fbt(
                    'Full decentralized governance',
                    'Full decentralized governance'
                  )}
                </div>
                <svg>
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                  <circle cx="102%" cy="50%" r="3" />
                </svg>
              </div>
            </div>
            <div className="right">
              <div className="event-container pt-5">
                <svg>
                  <circle cx="-1%" cy="50%" r="3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" />
                </svg>
                <div className="event">
                  {
                    ('Origin renounces ownership of all smart contracts',
                    'Origin renounces ownership of all smart contracts')
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex">
            <div className="left" />
            <div className="right" />
          </div>
        </div>
      </section>
      <section className="incentivizing text-center">
        <div className="container">
          <h3 className="text-white">
            {fbt('Incentivizing stakeholders', 'Incentivizing stakeholders')}
          </h3>
          <p className="m-auto w-lg-520">
            {fbt(
              'Governance privileges and incentives will be given to users that create value for the OUSD platform',
              'Governance privileges and incentives will be given to users that create value for the OUSD platform'
            )}
          </p>
          <div className="row px-5 d-flex flex-column flex-lg-row">
            <div className="col col-lg-4">
              <div className="image-container">
                <img
                  src="/images/convert-icon.svg"
                  alt="Token conversion icon"
                />
              </div>
              <div className="action">
                {fbt(
                  'Convert stablecoins to OUSD',
                  'Convert stablecoins to OUSD'
                )}
              </div>
            </div>
            <div className="col col-lg-4">
              <div className="image-container">
                <img
                  src="/images/liquidity-icon.svg"
                  alt="Liquidity supply icon"
                />
              </div>
              <div className="action">
                {fbt('Supply liquidity', 'Supply liquidity')}
              </div>
            </div>
            <div className="col col-lg-4">
              <div className="image-container">
                <img src="/images/ogn-icon.svg" alt="Origin Token (OGN) icon" />
              </div>
              <div className="action">{fbt('Stake OGN', 'Stake OGN')}</div>
            </div>
          </div>
        </div>
      </section>
      <section className="closing">
        <div className="container text-center">
          <Closing primary />
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #183140;
        }
        h1 {
          color: white;
          font-family: Poppins;
          font-size: 2.125rem;
          font-weight: 500;
          margin: 150px 0 0;
          text-align: center;
        }
        h2 {
          color: white;
          font-size: 1.5rem;
          line-height: 1.25;
          margin: 40px 0 0;
          text-align: center;
          opacity: 0.8;
        }
        h3 {
          color: black;
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 1.32;
          padding: 1rem 0;
          text-align: center;
        }
        .left {
          border-right: 1px dashed #bbc9da;
        }
        .left,
        .right {
          display: flex;
          min-height: 90px;
          width: 50%;
          flex-direction: column;
          justify-content: center;
        }
        section {
          padding: 0;
          position: relative;
        }
        section:nth-of-type(odd) {
          background-color: white;
        }
        section:nth-of-type(even) {
          background-color: #f3f5f8;
        }
        .number {
          color: #bbc9da;
          font-family: Poppins;
          font-size: 25rem;
          font-weight: 500;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          -webkit-transform: translate(-50%, -50%);
          opacity: 0.3;
        }
        .events {
          display: flex;
        }
        .event-container {
          align-items: center;
          display: flex;
          width: 100%;
        }
        .event {
          color: black;
          font-size: 1rem;
          line-height: 1.33;
          padding: 1rem;
          border: 1px solid;
          border-radius: 8px;
          width: 85%;
          border-left-width: 10px;
          position: relative;
          z-index: 2;
          background-color: white;
        }
        svg {
          overflow: visible;
          width: 15%;
        }
        circle,
        line {
          stroke: rgb(0, 0, 0);
          stroke-width: 1;
        }
        section:nth-of-type(1) .event {
          border-color: #7a26f3;
        }
        section:nth-of-type(1) circle,
        section:nth-of-type(1) line {
          fill: #7a26f3;
          stroke: #7a26f3;
        }
        section:nth-of-type(2) .event {
          border-color: #fec100;
        }
        section:nth-of-type(2) circle,
        section:nth-of-type(2) line {
          fill: #fec100;
          stroke: #fec100;
        }
        section:nth-of-type(3) .event {
          border-color: #1a82ff;
        }
        section:nth-of-type(3) circle,
        section:nth-of-type(3) line {
          fill: #1a82ff;
          stroke: #1a82ff;
        }
        section:nth-of-type(4) .event {
          border-color: #00d592;
        }
        section:nth-of-type(4) circle,
        section:nth-of-type(4) line {
          fill: #00d592;
          stroke: #00d592;
        }
        section.incentivizing {
          background-color: #1a82ff;
          color: white;
          padding: 100px 0;
        }
        .incentivizing p {
          max-width: 744px;
          opacity: 0.8;
          font-size: 1.125rem;
          line-height: 1.33;
        }
        .incentivizing .image-container {
          display: flex;
          justify-content: center;
          height: 86px;
          margin: 80px auto 30px;
        }
        .incentivizing .action {
          opacity: 0.8;
          font-size: 1.125rem;
          line-height: 1.33;
        }
        .closing {
          color: black;
          padding: 100px 0;
        }

        .phase {
          position: relative;
          z-index: 2;
        }
        @media (max-width: 992px) {
          h1 {
            margin-top: 40px;
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

          section.closing {
            padding-top: 60px;
            padding-bottom: 60px;
          }

          section.incentivizing {
            padding-top: 60px;
            padding-bottom: 60px;
          }

          .incentivizing .image-container {
            display: flex;
            justify-content: center;
            height: 56px;
            margin: 30px auto 30px;
          }
        }

        @media (min-width: 993px) {
          .w-lg-520 {
            max-width: 520px;
            width: 520px;
          }
        }
      `}</style>
    </Layout>
  )
}
