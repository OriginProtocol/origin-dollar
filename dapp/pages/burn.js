import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import Countdown from 'react-countdown'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import addresses from 'constants/contractAddresses'
import { formatCurrency, getRewardsApy } from 'utils/math'
import { assetRootPath } from 'utils/image'

import Layout from 'components/layout'
import Nav from 'components/Nav'

const BurnCountdown = ({ days, hours, minutes, seconds }) => {
  return (
    <>
      <div className="d-flex flex-row text-center">
        <div className="d-flex flex-column">
          <div className="number gradient1">{days}</div>
          <div className="label">Days</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number gradient1">{hours}</div>
          <div className="label">Hours</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number gradient1">{minutes}</div>
          <div className="label">Minutes</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number gradient1">{seconds}</div>
          <div className="label">Seconds</div>
        </div>
      </div>
      <style jsx>{`
        .number {
          font-size: 7rem;
          font-weight: 900;
        }

        .colon {
          font-size: 7rem;
          font-weight: 400;
          padding: 0 20px;
        }

        .label {
          font-size: 1.25rem;
          font-weight: 700;
        }

        @media (max-width: 799px) {
          .number {
            font-size: 3rem;
          }

          .colon {
            font-size: 3rem;
            padding: 0 10px;
          }

          .label {
            font-size: 0.625rem;
          }
        }
      `}</style>
    </>
  )
}

const renderer = ({ days, hours, minutes, seconds, completed }) => {
  if (completed) {
    return <span className="gradient1">OGV has been burned!</span>
  } else {
    return (
      <BurnCountdown
        days={days}
        hours={hours}
        minutes={minutes}
        seconds={seconds}
      />
    )
  }
}

export default function Burn({ locale, onLocale }) {
  const ogv = useStoreState(ContractStore, (s) => s.ogv || 0)
  const veogv = useStoreState(ContractStore, (s) => s.veogv || 0)
  const [totalStaked, setTotalStaked] = useState()
  const [totalSupply, setTotalSupply] = useState()
  const [totalVeSupply, setTotalVeSupply] = useState()
  const [optionalLockupBalance, setOptionalLockupBalance] = useState()
  const [mandatoryLockupBalance, setMandatoryLockupBalance] = useState()
  const burnAmount = optionalLockupBalance + mandatoryLockupBalance

  const optionalLockupDistributor = '0x7aE2334f12a449895AD21d4c255D9DE194fe986f'
  const mandatoryLockupDistributor =
    '0xD667091c2d1DCc8620f4eaEA254CdFB0a176718D'
  const initialSupply = 4000000000
  const airdropAllocationOgn = 1000000000
  const airdropAllocationOusd = 450000000
  const airdropAllocation = airdropAllocationOgn + airdropAllocationOusd

  const stakingApy =
    getRewardsApy(100 * 1.8 ** (48 / 12), 100, totalVeSupply) || 0

  useEffect(() => {
    if (!(ogv && veogv)) {
      return
    }
    const fetchStakedOgv = async () => {
      const staked = await ogv
        .balanceOf(addresses.mainnet.veOGV)
        .then((r) => Number(r) / 10 ** 18)
      const supply = await ogv.totalSupply().then((r) => Number(r) / 10 ** 18)
      const optional = await ogv
        .balanceOf(optionalLockupDistributor)
        .then((r) => Number(r) / 10 ** 18)
      const mandatory = await ogv
        .balanceOf(mandatoryLockupDistributor)
        .then((r) => Number(r) / 10 ** 18)
      const totalVe = await veogv
        .totalSupply()
        .then((r) => Number(r) / 10 ** 18)
      setTotalStaked(staked)
      setTotalSupply(supply)
      setOptionalLockupBalance(optional)
      setMandatoryLockupBalance(mandatory)
      setTotalVeSupply(totalVe)
    }
    fetchStakedOgv()
  }, [ogv, veogv])

  return (
    <Layout locale={locale}>
      <header>
        <Nav locale={locale} onLocale={onLocale} />
      </header>
      <section className="burn black">
        <div className="container d-flex flex-column text-align-left ml-lg-5 pl-lg-5">
          <h2>
            <img
              src={assetRootPath('/images/ogv-logo.svg')}
              className="ogv-logo pb-lg-3"
              alt="OGV logo"
            />
            {fbt('OGV BURN', 'OGV BURN')}
          </h2>
          <div className="text-container mb-5">
            {fbt(
              'On October 10th, 2022 at 0:00UTC all unclaimed tokens from the OGV airdrop will be burned forever.',
              'On October 10th, 2022 at 0:00UTC all unclaimed tokens from the OGV airdrop will be burned forever.'
            )}
          </div>
          <div className="text-container mt-5">
            {fbt('Countdown to burn', 'Countdown to burn')}
          </div>
          <Countdown date={'2022-10-10T00:00:00.000Z'} renderer={renderer} />
          <div className="flex-row mt-5 mb-5">
            <a
              href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
              target="_blank"
              rel="noopener noreferrer"
              className="button gradient2"
            >
              Buy OGV
            </a>
            <a
              href="https://governance.ousd.com/stake"
              target="_blank"
              rel="noopener noreferrer"
              className="button border"
            >
              Stake OGV
            </a>
          </div>
          <div className="text-container mt-5">
            {fbt('Estimated burn amount', 'Estimated burn amount')}{' '}
            <span className="subtext">
              {fbt('(currently unclaimed OGV)', '(currently unclaimed OGV')}
            </span>
          </div>

          <h1>
            {formatCurrency(burnAmount, 0)}
          </h1>

          <h3>
            <span className="percent gradient1">{`${formatCurrency(
              (burnAmount / initialSupply) * 100,
              2
            )}% `}</span>
            {fbt('of initial supply', ' of initial supply')}
          </h3>
          <div className="links flex-row">
            <div className="link">
              <a
                href={
                  'https://etherscan.io/address/0x7ae2334f12a449895ad21d4c255d9de194fe986f'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="gradient3">Liquid OGV airdrop contract</span>
                <img
                  src={assetRootPath('/images/external-link.svg')}
                  className="external-link"
                  alt="External link"
                />
              </a>
            </div>
            <div className="link">
              <a
                href={
                  'https://etherscan.io/address/0xd667091c2d1dcc8620f4eaea254cdfb0a176718d'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="gradient3">Locked OGV airdrop contract</span>
                <img
                  src={assetRootPath('/images/external-link.svg')}
                  className="external-link"
                  alt="External link"
                />
              </a>
            </div>
          </div>
        </div>
      </section>
      <section className="airdrop dim">
        <div className="container ml-lg-5 pl-lg-5">
          <div className="d-flex flex-column align-items-start">
            <div className="text-container">
              {fbt('The OGV airdrop', 'The OGV airdrop')}
            </div>
            <div className="subtext-container">
              As of July 12th, over 40,000 OGN holders and all OUSD holders
              became eligible to claim OGV, the new governance token for Origin
              Dollar. OGV accrues staking rewards, fees, and voting power when
              staked for one month or longer. The claim period for this airdrop
              runs for 90 days, after which all remaining tokens held in the
              distributor contracts will be burned. Centralized exchanges will
              be instructed to burn additional unclaimed tokens held in their
              accounts. Additional supply reductions occur through periodic
              automated buybacks funded by yield from OUSD.
            </div>
          </div>
          <div className="stats d-flex flex-column">
            <div className="d-flex flex-row">
              <div className="info-box airdrop">
                <div className="medium mb-3">Airdrop allocation stats</div>
                <div className="grey">Airdrop total</div>
                <div className="mb-4">
                  <span className="large">
                    {formatCurrency(airdropAllocation, 0)}
                  </span>
                  <span>{' OGV'}</span>
                </div>
                <div className="d-flex flex-row">
                  <div className="mr-lg-5 mr-md-3">
                    <div className="text-container">
                      <img
                        src={assetRootPath('/images/purple-dot-dark.svg')}
                        className="purple-dot mr-2"
                        alt="Purple dot"
                      />
                      <span className="grey">OGN holders</span>
                    </div>
                    <span className="medium">
                      {formatCurrency(airdropAllocationOgn, 0)}
                    </span>
                    <span>{' OGV'}</span>
                    <div className="grey">(68.97%)</div>
                  </div>
                  <div>
                    <div className="text-container">
                      <img
                        src={assetRootPath('/images/purple-dot-light.svg')}
                        className="purple-dot mr-2"
                        alt="Purple dot"
                      />
                      <span className="grey">OUSD holders</span>
                    </div>
                    <span className="medium">
                      {formatCurrency(airdropAllocationOusd, 0)}
                    </span>
                    <span>{' OGV'}</span>
                    <div className="grey">(31.03%)</div>
                  </div>
                </div>
              </div>
              <div className="info-box claim">
                <div className="medium mb-3">Claim stats</div>
                <div className="grey">Tokens claimed</div>
                <div className="mb-4">
                  <span className="large">
                    {formatCurrency(airdropAllocationOgn - burnAmount, 0)}
                  </span>
                  <span>{' OGV'}</span>
                  <span className="grey">{` (${formatCurrency(
                    ((airdropAllocation - burnAmount) * 100) /
                      airdropAllocation,
                    2
                  )}%)*`}</span>
                </div>
                <div className="d-flex flex-row">
                  <div className="mr-lg-5 mr-md-3">
                    <div className="text-container grey">OGN holders</div>
                    <span className="medium">
                      {formatCurrency(
                        airdropAllocationOgn - optionalLockupBalance,
                        0
                      )}
                    </span>
                    <span>{' OGV'}</span>
                    <div className="grey">{`(${formatCurrency(
                      ((airdropAllocationOgn - optionalLockupBalance) /
                        airdropAllocationOgn) *
                        100,
                      2
                    )}%)`}</div>
                  </div>
                  <div>
                    <div className="text-container grey">OUSD holders</div>
                    <span className="medium">
                      {formatCurrency(
                        airdropAllocationOusd - mandatoryLockupBalance,
                        0
                      )}
                    </span>
                    <span>{' OGV'}</span>
                    <div className="grey">{`(${formatCurrency(
                      ((airdropAllocationOusd - mandatoryLockupBalance) /
                        airdropAllocationOusd) *
                        100,
                      2
                    )}%)`}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="info-box stake d-flex flex-row">
              <div>
                <div className="medium mb-4">Staking stats</div>
                <div className="d-flex flex-row">
                  <div className="mr-lg-5 mr-md-4">
                    <div className="text-container grey">Total staked</div>
                    <span className="large">
                      {formatCurrency(totalStaked, 0)}
                    </span>
                    <span>{' OGV'}</span>
                  </div>
                  <div className="ml-lg-3">
                    <div className="text-container grey">Percentage staked</div>
                    <span className="large">{`${formatCurrency(
                      (totalStaked / totalSupply) * 100,
                      2
                    )}%`}</span>
                  </div>
                </div>
              </div>
              <div className="apy d-flex flex-column text-center">
                <div>
                  <span className="large">{`${formatCurrency(
                    stakingApy,
                    2
                  )}%`}</span>
                  {' APY'}
                </div>
                <div>
                  <a
                    href="https://governance.ousd.com/stake"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button border"
                  >
                    Stake OGV
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className='footnote'>* Not including portion of tokens sent to exchanges</div>
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #141519;
        }

        section.burn {
          background-image: url(/images/flame.svg);
          background-repeat: no-repeat;
          background-position: 100% -20%;
          background-size: 60vw;
          padding-top: 0px;
        }

        h1 {
          color: fafbfb;
          font-family: Poppins;
          font-size: 6rem;
          font-weight: 500;
          margin: 50px 0 20px 0;
        }

        h2 {
          color: fafbfb;
          font-family: Poppins;
          font-size: 4.5rem;
          font-weight: 500;
          margin: 80px 0 20px 0;
        }

        h3 {
          color: #fafbfb;
          font-family: Poppins;
          font-size: 2rem;
          font-weight: 500;
          line-height: 1.32;
          padding: 1rem 0;
        }

        .text-container {
          color: fafbfb;
          max-width: 550px;
          font-size: 1.25rem;
          font-weight: 500;
          line-height: 1.25;
        }

        .button {
          display: inline-block;
          border: 0;
          border-radius: 50px;
          white-space: nowrap;
          margin: 0px 10px 10px 10px;
          padding: 15px 0;
          text-align: center;
          width: 30%;
        }

        .subtext {
          opacity: 0.7;
        }

        .external-link {
          width: 16px;
          margin-left: 10px;
          margin-right: 50px;
          padding-bottom: 2px;
          line-height: 20px;
        }

        .ogv-logo {
          width: 10%;
          margin-right: 1vw;
        }

        .info-box {
          margin: 7px;
          padding: 30px;
          background-color: #141519;
          border-radius: 10px;
        }

        .info-box.claim {
          width: 100%;
        }

        .info-box.airdrop {
          width: 100%;
          background-image: url(/images/pie-chart.svg);
          background-repeat: no-repeat;
          background-position: 100% 50%;
          background-size: 12.5vw;
        }

        .info-box.stake {
          flex: 1;
        }

        .subtext-container {
          color: fafbfb;
          margin-top: 20px;
          font-size: 1rem;
          line-height: 2;
          opacity: 0.6;
        }

        .stats {
          width: 70vw;
          margin-top: 50px;
        }

        .apy {
          align-self: flex-start;
          margin-right: 20px;
          margin-left: auto;
        }

        .apy .button {
          display: inline-block;
          border: 0;
          border-radius: 50px;
          white-space: nowrap;
          margin-top: 10px;
          padding: 15px 0px;
          text-align: center;
          width: 100%;
        }

        .grey {
          font-weight: 300;
          opacity: 0.5;
        }

        .large {
          font-size: 2rem;
        }

        .medium {
          font-size: 1.25rem;
        }

        .link {
          display: inline;
        }

        .footnote {
          font-size: 0.75rem;
          margin-top: 2vw;
          margin-left: 2vw;
        }

        @media (max-width: 1199px) {
          .stats {
            width: 80vw;
            margin-top: 100px;
          }

          h1 {
            margin-top: 15px;
          }

          .large {
            font-size: 1.5rem;
          }

          .medium {
            font-size: 1rem;
          }

          .grey {
            font-size: 1rem;
          }

          .ogv-logo {
            width: 12.5%;
            margin-bottom: 1vw;
          }
        }

        @media (max-width: 799px) {
          .stats {
            display: none !important;
          }

          .footnote {
            display: none !important;
          }

          section.burn {
            background-position: 100% 0%;
            background-size: 80vw;
          }

          .container {
            padding-left: 30px;
            padding-right: 30px;
          }

          h1 {
            font-size: 2.5rem;
            margin-top: 20px;
          }

          h2 {
            font-size: 3rem;
          }

          h3 {
            font-size: 1.5rem;
          }

          .button {
            width: 40%;
          }

          .links {
            display: flex;
          }

          .link {
            width: 50%;
          }

          .ogv-logo {
            width: 15%;
            margin-bottom: 2vw;
          }
        }
      `}</style>
    </Layout>
  )
}
