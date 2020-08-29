import React from 'react'
import { fbt } from 'fbt-runtime'

import Closing from 'components/Closing'
import EmailForm from 'components/EmailForm'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'

const discordURL = process.env.DISCORD_URL
const docsURL = process.env.DOCS_URL
const githubURL = process.env.GITHUB_URL

const Home = ({ locale, onLocale }) => {
  return (
    <Layout>
      <header className="text-white">
        <Nav locale={locale} onLocale={onLocale} />
        <div className="container">
          <div className="hero text-center">
            <div className="circle" ></div>
            <div className="circle circle2" ></div>
            <div className="circle circle3" ></div>
            <div className="circle circle4" ></div>
            <img src="/images/coin-waves.svg" alt="Waves" className="waves" />
            <img src="/images/ousd-coin.svg" alt="OUSD coin" className="coin" />
            <div className="container d-flex flex-column align-items-center">
              <div className="introducing">{fbt('Introducing', 'Introducing')}</div>
              <div className="ticker-symbol">OUSD</div>
              <h1>{fbt('The first stablecoin that earns a yield while it’s still in your wallet', 'The first stablecoin that earns a yield while it’s still in your wallet')}</h1>
              <GetOUSD style={{ marginTop: 40 }} className="mx-auto" light />
            </div>
          </div>
          <hr />
        </div>
      </header>
      <section className="dark">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <div className="current">{fbt('Currently earning', 'Currently earning')}</div>
                <div className="rate">15.34% APY</div>
                <h2>{fbt('Convert your USDT, USDC, and DAI to OUSD to start earning yields', 'Convert your USDT, USDC, and DAI to OUSD to start earning yields')}</h2>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center order-lg-1">
              <img src="/images/3-up-graphic.svg" alt="Three tokens become one" />
            </div>
          </div>
        </div>
      </section>
      <section className="light">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h3>{fbt('All the earnings, none of the hassles', 'All the earnings, none of the hassles')}</h3>
                <p>{fbt('DeFi yields are automatically converted to OUSD and accrue in your wallet. Your OUSD balance compounds continuously. No staking or lock ups are required.', 'DeFi yields are automatically converted to OUSD and accrue in your wallet. Your OUSD balance compounds continuously. No staking or lock-ups are required.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/earnings-graphic.svg" alt="Earnings" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <h3>{fbt('Spend your OUSD with ease', 'Spend your OUSD with ease')}</h3>
                <p>{fbt('There\'s no need to unwind complicated positions when you want to spend your OUSD. Transfer OUSD without having to unstake or unlock capital.', 'There\'s no need to unwind complicated positions when you want to spend your OUSD. Transfer OUSD without having to unstake or unlock capital.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center order-lg-1">
              <img src="/images/spend-graphic.svg" alt="Spend" />
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>{fbt('Elastic supply, stable price', 'Elastic supply, stable price')}</h4>
                <p>{fbt('OUSD is pegged to the US Dollar. Returns are distributed as additional units of OUSD. Supply rebasing happens continuously. See your OUSD grow much faster than your USD grows in traditional savings accounts.', 'OUSD is pegged to the US Dollar. Returns are distributed as additional units of OUSD. Supply rebasing happens continuously. See your OUSD grow much faster than your USD grows in traditional savings accounts.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/elastic-graphic.svg" alt="Elastic" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <h4>{fbt('1:1 backed by other stablecoins', '1:1 backed by other stablecoins')}</h4>
                <p>{fbt('OUSD is secured by other proven stablecoins like USDT, USDC, and DAI. Capital is further insured by governance tokens issued by platforms like Compound and MakerDAO.', 'OUSD is secured by other proven stablecoins like USDT, USDC, and DAI. Capital is further insured by governance tokens issued by platforms like Compound and MakerDAO.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center order-lg-1">
              <img src="/images/backed-graphic.svg" alt="Backed" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>{fbt('Automated yield farming', 'Automated yield farming')}</h4>
                <p>{fbt('Automated algorithms in transparent OUSD smart contracts manage your funds. See exactly how your money is being put to work.', 'Automated algorithms in transparent OUSD smart contracts manage your funds. See exactly how your money is being put to work.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/automatic-graphic.svg" alt="Automatic" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center order-lg-2">
              <div className="text-container">
                <h4>{fbt('You always have full control', 'You always have full control')}</h4>
                <p>{fbt('Store and earn OUSD with non-custodial Ethereum wallets. Enter and exit OUSD whenever you want. There\'s no minimum holding period to earn yields.', 'Store and earn OUSD with non-custodial Ethereum wallets. Enter and exit OUSD whenever you want. There\'s no minimum holding period to earn yields.')}</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center order-lg-1">
              <img src="/images/control-graphic.svg" alt="Control" />
            </div>
          </div>
        </div>
      </section>
      <section className="dark">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>{fbt('Created by cryptocurrency and fintech veterans', 'Created by cryptocurrency and fintech veterans')}</h5>
            <p className="team-summary">{fbt('The Origin Dollar is brought to you by the team at Origin Protocol, which includes serial entrepreneurs, early cryptocurrency investors, early employees at YouTube, engineering managers at Google/Dropbox, and one of the Paypal co-founders.', 'The Origin Dollar is brought to you by the team at Origin Protocol, which includes serial entrepreneurs, early cryptocurrency investors, early employees at YouTube, engineering managers at Google/Dropbox, and one of the Paypal co-founders.')}</p>
            <div className="logos d-flex">
              <img src="/images/youtube-logo.svg" alt="YouTube logo" />
              <img src="/images/paypal-logo.svg" alt="PayPal logo" />
              <img src="/images/google-logo.svg" alt="Google logo" />
              <img src="/images/dropbox-logo.svg" alt="Dropbox logo" />
            </div>
            <a href="https://originprotocol.com/team" target="_blank" rel="noopener noreferrer" className="btn btn-outline-light mx-auto d-flex align-items-center justify-content-center meet-team">Meet the Team</a>
            <div className="form-container">
              <h5>{fbt('Stay up to date', 'Stay up to date')}</h5>
              <p className="email-cta mx-auto">{fbt('Be the first to get updates about OUSD, rewards tokens, and our upcoming transition to decentralized governance.', 'Be the first to get updates about OUSD, rewards tokens, and our upcoming transition to decentralized governance.')}</p>
              <EmailForm />
            </div>
          </div>
        </div>
      </section>
      <section className="light perfection">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>{fbt('The perfect stablecoin for both spending and saving', 'The perfect stablecoin for both spending and saving')}</h5>
          </div>
          <div className="row">
            <div className="col-6 col-md-4 ml-auto text-center">
              <div className="image-container">
                <img src="/images/savings-icon.svg" alt="Savings icon" />
              </div>
              <h6>{fbt('Beat traditional savings and money markets', 'Beat traditional savings and money markets')}</h6>
              <p>{fbt('At estimated APYs over 15%, OUSD earnings trounce traditional financial instruments.', 'At estimated APYs over 15%, OUSD earnings trounce traditional financial instruments.')}</p>
            </div>
            <div className="col-6 col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/transfer-icon.svg" alt="Transfer icon" />
              </div>
              <h6>{fbt('Instantaneous peer-to-peer transfers', 'Instantaneous peer-to-peer transfers')}</h6>
              <p>{fbt('Send OUSD to pay your friends and family instead of using Venmo or Paypal. They’ll earn yield immediately.', 'Send OUSD to pay your friends and family instead of using Venmo or Paypal. They’ll earn yield immediately.')}</p>
            </div>
          </div>
          <div className="row">
            <div className="col-6 col-md-4 ml-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/remittances-icon.svg" alt="Remittances icon" />
              </div>
              <h6>{fbt('Remittances without fees', 'Remittances without fees')}</h6>
              <p>{fbt('Need to send money to China or the Philippines? Your recipients get OUSD without losing the average of 6.7% on fees.', 'Need to send money to China or the Philippines? Your recipients get OUSD without losing the average of 6.7% on fees.')}</p>
            </div>
            <div className="col-6 col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/value-icon.svg" alt="Value icon" />
              </div>
              <h6>{fbt('A superior store of value', 'A superior store of value')}</h6>
              <p>{fbt('OUSD is an ideal store of value for users in countries with hyperinflationary economies like Venezuela and Argentina.', 'OUSD is an ideal store of value for users in countries with hyperinflationary economies like Venezuela and Argentina.')}</p>
            </div>
          </div>
          <div className="row">
            <div className="col-6 col-md-4 ml-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/use-case-icon.svg" alt="Use case icon" />
              </div>
              <h6>{fbt('DeFi meets decentralized commerce', 'DeFi meets decentralized commerce')}</h6>
              <p>{fbt('OUSD will be accepted by hundreds of sellers on the Origin Dshop network and peer-to-peer marketplace.', 'OUSD will be accepted by hundreds of sellers on the Origin Dshop network and peer-to-peer marketplace.')}</p>
            </div>
            <div className="col-6 col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/account-icon.svg" alt="Account icon" />
              </div>
              <h6>{fbt('A better unit of account', 'A better unit of account')}</h6>
              <p>{fbt('Easily track your DeFi earnings without complicated spreadsheets and custom dashboards.', 'Easily track your DeFi earnings without complicated spreadsheets and custom dashboards.')}</p>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container text-center">
          <h5>{fbt('Follow our development', 'Follow our development')}</h5>
          <div className="d-flex community-buttons flex-column flex-lg-row justify-content-center">
            <a href={discordURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light d-flex align-items-center justify-content-center">
              <img src="/images/discord-icon.svg" alt="Discord logo" />&nbsp;{fbt('Join us on Discord', 'Join us on Discord')}
            </a>
            <a href={githubURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light d-flex align-items-center justify-content-center">
              <img src="/images/github-icon.svg" alt="GitHub logo" />&nbsp;{fbt('Check out our GitHub', 'Check out our GitHub')}
            </a>
            <a href={docsURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light d-flex align-items-center justify-content-center">
              <img src="/images/docs-icon.svg" alt="Docs icon" />&nbsp;{fbt('View the documentation', 'View the documentation')}
            </a>
          </div>
          <Closing light />
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #183140;
          position: relative;
        }

        hr {
          border-top: solid 1px #8293a4;
          margin: 150px 0 0;
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
          top: 230px;
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

        .rate {
          font-family: Poppins;
          font-size: 5.25rem;
          line-height: 1;
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

        .row:not(:first-of-type) {
          margin-top: 100px;
        }

        h5 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 1.32;
        }

        .team-summary {
          max-width: 740px;
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

        .dark .btn {
          border-radius: 25px;
          border: solid 1px #ffffff;
          font-size: 1.125rem;
          font-weight: bold;
          color: #fafbfc;
        }

        .meet-team {
          margin-top: 80px;
          min-width: 201px;
          min-height: 50px;
        }

        .form-container {
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
          border-bottom: solid 1px white;
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
          max-width: 500px;
          z-index: 1;
        }

        .light h3 {
          max-width: 330px; 
        }

        @media (max-width: 992px) {
          header {
            padding-bottom: 60px;
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

          img:not(.waves) {
            max-width: 100%;
          }

          .logos {
            margin-top: 40px;
          }

          .logos img {
            max-height: calc(100vw * 0.03);
          }

          .meet-team {
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
        }

        @keyframes circle-grow {
          0% {
            width: 140px;
            height: 140px;
            top: 230px;
            opacity: 0.4;
          }

          90% {
            0.5
            width: 559px;
            height: 559px;
          }

          100% {
            width: 605px;
            height: 605px;
            top: 0px;
            opacity: 0;
          }
        }

      `}</style>
    </Layout>
  )
}

export default Home
