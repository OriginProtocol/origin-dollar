import React from 'react'

import Closing from 'components/Closing'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'

export default function Home({ locale, onLocale }) {
  return (
    <Layout>
      <header className="text-white">
        <Nav locale={locale} onLocale={onLocale} />
        <div className="hero text-center">
          <img src="/images/coin-waves.svg" alt="Waves" loading="lazy" className="waves" />
          <img src="/images/ousd-coin.svg" alt="OUSD coin" loading="lazy" className="coin" />
          <div className="container">
            <div className="introducing">Introducing</div>
            <div className="ticker-symbol">OUSD</div>
            <h1>The first stablecoin that earns a yield<br className="d-none d-md-inline" />while it’s still in your wallet</h1>
            <GetOUSD style={{ marginTop: 40 }} className="mx-auto" light />
          </div>
        </div>
      </header>
      <section className="dark">
        <div className="container">
          <div className="row">
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/3-up-graphic.svg" alt="Three tokens become one" loading="lazy" />
            </div>
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <div className="current">Currently earning</div>
                <div className="cake">15.34% APY</div>
                <div className="icing">plus rewards tokens</div>
                <h2>Convert your USDT, USDC, and DAI to OUSD to start earning yields</h2>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="light">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h3>All the earnings,<br />none of the hassles</h3>
                <p>DeFi yields are automatically converted to OUSD and accrue in your wallet. Your OUSD balance compounds continuously. No staking or lock ups are required.</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/earnings-graphic.svg" alt="Earnings" loading="lazy" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/spend-graphic.svg" alt="Spend" loading="lazy" />
            </div>
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h3>Spend your OUSD<br />with ease</h3>
                <p>There's no need to unwind complicated positions when you want to spend your OUSD. Transfer it with ease without having to unstake or unlock capital.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>Elastic supply,<br />stable price</h4>
                <p>OUSD is pegged to $1 USD. Returns are distributed as additional units of OUSD. Supply rebasing happens continuously. See your OUSD grow much faster than your USD grows in traditional savings accounts.</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/elastic-graphic.svg" alt="Elastic" loading="lazy" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/backed-graphic.svg" alt="Backed" loading="lazy" />
            </div>
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>1:1 backed<br />by other stablecoins</h4>
                <p>OUSD is secured by other proven stablecoins like USDT, USDC, and DAI. Capital is further ensured by governance tokens issued by platforms like Compound and MakerDAO. Origin Dollar Governance (OGV) tokens serve as the final layer of security and stability.</p>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>Earnings are automatic<br />and transparent</h4>
                <p>Automated algorithms in OUSD smart contracts manage your funds. See exactly how your money is being put to work.</p>
              </div>
            </div>
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/automatic-graphic.svg" alt="Automatic" loading="lazy" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-7 d-flex flex-column align-items-center justify-content-center">
              <img src="/images/control-graphic.svg" alt="Control" loading="lazy" />
            </div>
            <div className="col-lg-5 d-flex flex-column align-items-center justify-content-center">
              <div className="text-container">
                <h4>You always have<br />full control</h4>
                <p>Store and earn OUSD with non-custodial Ethereum wallets. Enter and exit OUSD whenever you want. There's no minimum holding period to earn yields.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="dark">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>Created by cryptocurrency and fintech veterans</h5>
            <p className="team-summary">OUSD is brought to you by the Origin Protocol team that includes serial entrepreneurs, early cryptocurrency investors, early employees at YouTube, and even a Paypal co-founder. OUSD will be an accepted form of payment by hundreds of applications built on the Origin Platform.</p>
            <div className="logos d-flex">
              <img src="/images/youtube-logo.svg" alt="YouTube logo" loading="lazy" />
              <img src="/images/paypal-logo.svg" alt="PayPal logo" loading="lazy" />
              <img src="/images/google-logo.svg" alt="Google logo" loading="lazy" />
            </div>
            <a href="https://originprotocol.com/team" target="_blank" rel="noopener noreferrer" className="btn btn-outline-light mx-auto d-flex align-items-center justify-content-center meet-team">Meet the Team</a>
            <form className="w-100" onSubmit={() => alert('To do')}>
              <h5>Stay up to date</h5>
              <p>Be the first to get updates about OUSD and the upcoming launch of our governance token.</p>
              <div className="d-flex justify-content-center">
                <input type="email" placeholder="Your email" className="form-control" />
                <button type="submit" className="btn btn-outline-light d-flex align-items-center justify-content-center subscribe">Subscribe</button>
              </div>
            </form>
          </div>
        </div>
      </section>
      <section className="light perfection">
        <div className="container">
          <div className="text-container text-center d-flex flex-column align-items-center">
            <h5>The perfect stablecoin for both spending and saving</h5>
          </div>
          <div className="row">
            <div className="col-md-4 ml-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/use-case-icon.svg" alt="Use case icon" loading="lazy" />
              </div>
              <h6>DeFi meets decentralized commerce</h6>
              <p>OUSD will be accepted by hundreds of sellers on the Origin Dshop network and peer-to-peer marketplace.</p>
            </div>
            <div className="col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/transfer-icon.svg" alt="Transfer icon" loading="lazy" />
              </div>
              <h6>Instantaneous peer-to-peer transfers</h6>
              <p>Send OUSD to pay your friends and family instead of using Venmo or Paypal. They’ll earn yield immediately.</p>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4 ml-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/remittances-icon.svg" alt="Remittances icon" loading="lazy" />
              </div>
              <h6>Remittances without fees</h6>
              <p>Need to send money to China or the Philippines? Your recipients get OUSD without losing the average of 6.7% on fees.</p>
            </div>
            <div className="col-md-4 offset-md-1 mr-auto text-center">
              <div className="image-container d-flex justify-content-center">
                <img src="/images/value-icon.svg" alt="Value icon" loading="lazy" />
              </div>
              <h6>A better store of value</h6>
              <p>OUSD is an ideal store of value for users in countries with hyperinflationary economies like Venezuela and Argentina.</p>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4 mx-auto text-center">
              <div className="image-container">
                <img src="/images/savings-icon.svg" alt="Savings icon" loading="lazy" />
              </div>
              <h6>Beat traditional savings and money markets</h6>
              <p>At estimated APYs over 15%, OUSD earnings trounce traditional financial instruments.</p>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container text-center">
          <h5>Follow our development</h5>
          <div className="d-flex community-buttons">
            <a href="https://originprotocol.com/discord" target="_blank" rel="noopener noreferrer" className="btn btn-outline-light ml-auto d-flex align-items-center justify-content-center join-discord">
              <img src="/images/discord-icon.svg" alt="Discord logo" loading="lazy" />&nbsp;Join us on Discord
            </a>
            <a href="https://github.com/originprotocol" target="_blank" rel="noopener noreferrer" className="btn btn-outline-light mr-auto d-flex align-items-center justify-content-center visit-github">
              <img src="/images/github-icon.svg" alt="GitHub logo" loading="lazy" />&nbsp;Check out our GitHub
            </a>
          </div>
          <Closing />
        </div>
      </section>
      <style jsx>{`
        header {
          position: relative;
          padding-bottom: 100px;
        }

        .waves {
          position: absolute;
          top: 0;
          transform: translate(-50%);
          z-index: 1;
        }

        .coin {
          position: absolute;
          top: 230px;
          transform: translate(-50%);
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

        .cake {
          font-family: Poppins;
          font-size: 5.25rem;
          line-height: 1;
        }

        .icing {
          font-size: 0.8125rem;
          line-height: 1.85;
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
        }

        .logos img:nth-of-type(2) {
          margin: 0 80px;
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

        form {
          border-top: solid 1px #8293a4;
          margin-top: 80px;
          padding-top: 80px;
        }

        form div {
          margin-top: 60px;
        }

        input[type="email"] {
          width: 281px;
          min-height: 3.125rem;
          border-radius: 5px;
          border: solid 1px #4b5764;
          background-color: #000000;
          color: white;
          font-size: 1.125rem;
        }

        .subscribe {
          min-width: 161px;
          min-height: 50px;
          margin-left: 20px;
        }

        ::placeholder {
          color: #8293a4;
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

        .community-buttons .btn img {
          margin-right: 10px;
        }

        .visit-github {
          margin-left: 20px;
        }
      `}</style>
    </Layout>
  )
}
