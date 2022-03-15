import { fbt } from 'fbt-runtime'

import Closing from 'components/Closing'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import { assetRootPath } from 'utils/image'

export default function Governance({ locale, onLocale }) {
  return (
    <Layout locale={locale}>
      <header>
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container d-flex flex-column align-items-center">
          <h1 className="w-lg-520">
            {fbt('Decentralized Governance', 'Decentralized Governance')}
          </h1>
          <h2 className="w-lg-520">
            {fbt(
              'The protocol is developed and maintained by Origin Protocol and governed fully by its users',
              'The protocol is developed and maintained by Origin Protocol and governed fully by its users'
            )}
          </h2>
        </div>
      </header>
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
                  src={assetRootPath('/images/convert-icon.svg')}
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
                  src={assetRootPath('/images/liquidity-icon.svg')}
                  alt="Liquidity supply icon"
                />
              </div>
              <div className="action">
                {fbt('Supply liquidity', 'Supply liquidity')}
              </div>
            </div>
            <div className="col col-lg-4">
              <div className="image-container">
                <img
                  src={assetRootPath('/images/ogn-icon.svg')}
                  alt="Origin Token (OGN) icon"
                />
              </div>
              <div className="action">{fbt('Stake OGN', 'Stake OGN')}</div>
            </div>
          </div>
        </div>
      </section>
      <section className="dark pb-100 work-in-progress px-0">
        <div className="container">
          <div className="text-container d-flex flex-column align-items-start">
            <h5 className="mb-5">
              {fbt(
                'Help shape the future of OUSD',
                'Help shape the future of OUSD'
              )}
            </h5>
            <div className="d-flex justify-content-start flex-column flex-md-row">
              <div
                className="d-flex flex-column big-info-box col-12 col-md-4 mr-md-4"
                onClick={() => {
                  window.open(
                    'https://discord.com/invite/jyxpUSe',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="inner-info-box discord d-flex justify-content-center align-items-center">
                  <img src={assetRootPath('/images/logos/discord.jpeg')} />
                </div>
                <div className="inner-info-box-title">
                  {fbt('Discord', 'Discord')}
                </div>
                <div className="">
                  {fbt(
                    'Join our Discord to share proposals, provide feedback, get pointers on how to contribute, and shape the future of the protocol with OUSD community.',
                    'Join our Discord to share proposals, provide feedback, get pointers on how to contribute, and shape the future of the protocol with OUSD community.'
                  )}
                </div>
              </div>
              <div
                className="d-flex flex-column big-info-box col-12 col-md-4 mr-md-4"
                onClick={() => {
                  window.open(
                    'https://github.com/OriginProtocol/origin-dollar',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="inner-info-box github d-flex justify-content-center align-items-center">
                  <img src={assetRootPath('/images/logos/github-logo.svg')} />
                </div>
                <div className="inner-info-box-title">
                  {fbt('Github', 'Github')}
                </div>
                <div className="">
                  {fbt(
                    'Explore the source code and inspect in detail how OUSD functions or clone the project if you want to contribute.',
                    'Explore the source code and inspect in detail how OUSD functions or clone the project if you want to contribute.'
                  )}
                </div>
              </div>
              <div
                className="d-flex flex-column big-info-box col-12 col-md-4 mr-md-2"
                onClick={() => {
                  window.open(
                    'https://snapshot.org/#/origingov.eth',
                    '_blank',
                    'noopener'
                  )
                }}
              >
                <div className="inner-info-box snapshot d-flex justify-content-center align-items-center">
                  <img src={assetRootPath('/images/logos/snapshot.jpeg')} />
                </div>
                <div className="inner-info-box-title">
                  {fbt('Snapshot', 'Snapshot')}
                </div>
                <div className="">
                  {fbt(
                    'Off chain voting interface where users can express their sentiment on various proposals.',
                    'Off chain voting interface where users can express their sentiment on various proposals.'
                  )}
                </div>
              </div>
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
          margin: 40px 0 70px;
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
        section.dark {
          background-color: #183140 !important;
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

        section.dark {
          padding: 113px 40px 140px 40px;
        }

        .dark .btn {
          border-radius: 25px;
          border: solid 1px #ffffff;
          font-size: 1.125rem;
          font-weight: bold;
        }

        h5 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 300;
          line-height: 1.32;
        }

        .big-info-box {
          border: 1px solid #ffffff22;
          background-color: #ffffff0a;
          border-radius: 10px;
          padding: 20px;
          cursor: pointer;
        }

        .big-info-box:hover {
          border: 1px solid #ffffff44;
          background-color: #ffffff22;
        }

        .inner-info-box {
          background-color: #ffffff88;
          border-radius: 10px;
          min-height: 150px;
          height: 150px;
          min-width: 150px;
          width: 150px;
          color: black;
          margin-bottom: 20px;
        }

        .inner-info-box.snapshot,
        .inner-info-box.discord {
          background-color: white;
        }

        .inner-info-box.github {
          background-color: black;
        }

        .inner-info-box img {
          max-width: 150px;
          max-height: 150px;
          padding: 10px;
        }

        .inner-info-box-title {
          margin-bottom: 20px;
          font-size: 24px;
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
            margin-bottom: 50px;
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

          .big-info-box {
            margin-bottom: 40px;
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
