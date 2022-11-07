import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { fbt } from 'fbt-runtime'
import Layout from 'components/layout'
import Countdown, { zeroPad } from 'react-countdown'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import addresses from 'constants/contractAddresses'
import { formatCurrency, getRewardsApy } from 'utils/math'
import { assetRootPath } from 'utils/image'
import withIsMobile from 'hoc/withIsMobile'
import { Header } from '@originprotocol/origin-storybook'
import { fetchAPI } from '../lib/api'
import transformLinks from '../src/utils/transformLinks'

const BurnCountdown = ({ days, hours, minutes, seconds }) => {
  return (
    <>
      <div className="text mt-5">
        {fbt('Countdown to burn', 'Countdown to burn')}
      </div>
      <div className="d-flex flex-row text-center">
        <div className="d-flex flex-column">
          <div className="number text-gradient1">{zeroPad(days)}</div>
          <div className="label">Days</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number text-gradient1">{zeroPad(hours)}</div>
          <div className="label">Hours</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number text-gradient1">{zeroPad(minutes)}</div>
          <div className="label">Minutes</div>
        </div>
        <div className="colon">:</div>
        <div className="d-flex flex-column">
          <div className="number text-gradient1">{zeroPad(seconds)}</div>
          <div className="label">Seconds</div>
        </div>
      </div>
      <style jsx>{`
        .text {
          color: fafbfb;
          max-width: 550px;
          font-size: 1.25rem;
          font-weight: 500;
          line-height: 1.25;
        }

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
    return (
      <>
        <div className="text text-gradient1">Burn complete!</div>
        <style jsx>{`
          .text {
            font-size: 7rem;
            font-weight: 900;
          }

          @media (max-width: 799px) {
            .text {
              font-size: 3rem;
            }
          }
        `}</style>
      </>
    )
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

const Burn = ({ locale, onLocale, isMobile, navLinks }) => {
  const ogv = useStoreState(ContractStore, (s) => s.ogv || 0)
  const veogv = useStoreState(ContractStore, (s) => s.veogv || 0)
  const [totalStaked, setTotalStaked] = useState()
  const [totalSupply, setTotalSupply] = useState()
  const [totalVeSupply, setTotalVeSupply] = useState()
  const [optionalLockupBalance, setOptionalLockupBalance] = useState()
  const [mandatoryLockupBalance, setMandatoryLockupBalance] = useState()
  const [burnedOptionalAmount, setBurnedOptionalAmount] = useState(0)
  const [burnedMandatoryAmount, setBurnedMandatoryAmount] = useState(0)
  const [currentBlock, setCurrentBlock] = useState()

  const mandatoryDistributorInitialOgv = 398752449
  const optionalDistributorInitialOgv = 747905084
  const distributorInitialOgv =
    mandatoryDistributorInitialOgv + optionalDistributorInitialOgv

  const initialSupply = 4000000000
  const airdropAllocationOgn = 1000000000
  const airdropAllocationOusd = 450000000
  const airdropAllocation = airdropAllocationOgn + airdropAllocationOusd
  const burnBlock = 15724869
  const burnOver = burnBlock < currentBlock
  const burnedAmount = burnedOptionalAmount + burnedMandatoryAmount
  const burnAmount = burnOver
    ? burnedAmount
    : optionalLockupBalance + mandatoryLockupBalance

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
        .balanceOf(addresses.mainnet.optionalLockupDistributor)
        .then((r) => Number(r) / 10 ** 18)
      const mandatory = await ogv
        .balanceOf(addresses.mainnet.mandatoryLockupDistributor)
        .then((r) => Number(r) / 10 ** 18)
      const totalVe = await veogv
        .totalSupply()
        .then((r) => Number(r) / 10 ** 18)
      setTotalStaked(staked)
      setTotalSupply(supply)
      setOptionalLockupBalance(optional)
      setMandatoryLockupBalance(mandatory)
      setTotalVeSupply(totalVe)

      const jsonRpcProvider = new ethers.providers.StaticJsonRpcProvider(
        process.env.ETHEREUM_RPC_PROVIDER,
        { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
      )
      const block = await jsonRpcProvider.getBlockNumber()
      setCurrentBlock(block)

      if (burnOver) {
        const burnedOptional = await ogv
          .balanceOf(addresses.mainnet.optionalLockupDistributor, {
            blockTag: burnBlock,
          })
          .then((r) => Number(r) / 10 ** 18)
        const burnedMandatory = await ogv
          .balanceOf(addresses.mainnet.mandatoryLockupDistributor, {
            blockTag: burnBlock,
          })
          .then((r) => Number(r) / 10 ** 18)
        setBurnedOptionalAmount(burnedOptional)
        setBurnedMandatoryAmount(burnedMandatory)
        setOptionalLockupBalance(burnedOptional)
        setMandatoryLockupBalance(burnedMandatory)
      }
    }
    fetchStakedOgv()
  }, [ogv, veogv, currentBlock])

  return (
    <Layout locale={locale}>
      <section className="burn black">
        <Header mappedLinks={navLinks} webProperty="ousd" />
        <div className="container d-flex flex-column text-align-left ml-lg-5 pl-lg-5">
          <h2 className="mt-4">
            <img
              src={assetRootPath('/images/ogv-logo.svg')}
              className="ogv-logo pb-lg-3 inline"
              alt="OGV logo"
            />
            {fbt('OGV BURN', 'OGV BURN')}
          </h2>
          <div className="text-container mb-5">
            {fbt(
              'On October 10th, 2022 at 0:00UTC all unclaimed tokens from the OGV airdrop were burned forever.',
              'On October 10th, 2022 at 0:00UTC all unclaimed tokens from the OGV airdrop were burned forever.'
            )}
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
            {burnOver ? (
              fbt('OGV burned', 'OGV burned')
            ) : (
              <>
                {fbt('Estimated burn amount', 'Estimated burn amount')}{' '}
                <span className="subtext">
                  {fbt('(currently unclaimed OGV)', '(currently unclaimed OGV')}
                </span>
              </>
            )}
          </div>

          <h1>{formatCurrency(burnOver ? burnedAmount : burnAmount, 0)}</h1>

          <h3>
            <span className="percent text-gradient1">{`${formatCurrency(
              (burnAmount / initialSupply) * 100,
              2
            )}% `}</span>
            {fbt('of initial supply', ' of initial supply')}
          </h3>
          <div className="links">
            <div className="link">
              <a
                href={
                  'https://etherscan.io/address/0x7ae2334f12a449895ad21d4c255d9de194fe986f'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-2">Liquid OGV airdrop contract</span>
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
                <span className="text-gradient2">
                  Locked OGV airdrop contract
                </span>
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
              ran for 90 days, after which all remaining tokens held in the
              distributor contracts were burned. Centralized exchanges have been
              instructed to burn additional unclaimed tokens held in their
              accounts. Additional supply reductions occur through periodic
              automated buybacks funded by yield from OUSD.
            </div>
            <div className="link mt-2">
              <a
                href={
                  'https://blog.originprotocol.com/tokenomics-retroactive-rewards-and-prelaunch-liquidity-mining-campaign-for-ogv-1b20b8ab41c8'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-gradient2">Learn more</span>
                <img
                  src={assetRootPath('/images/external-link.svg')}
                  className="external-link"
                  alt="External link"
                />
              </a>
            </div>
          </div>
          <div className="stats d-flex flex-column">
            <div className={`d-flex layout`}>
              <div className="info-box airdrop">
                <div className="medium mb-3">Airdrop allocation stats</div>
                <div className="grey">Airdrop total</div>
                <div className="mb-4">
                  <span className="large">
                    {formatCurrency(airdropAllocation, 0)}
                  </span>
                  <span className="small">{' OGV'}</span>
                </div>
                <div className={`d-flex layout`}>
                  <div className={`mr-lg-5 mr-md-3 ${isMobile ? 'mb-3' : ''}`}>
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
                    <span className="small">{' OGV'}</span>
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
                    <span className="small">{' OGV'}</span>
                    <div className="grey">(31.03%)</div>
                  </div>
                </div>
              </div>
              <div
                className={`info-box claim ${isMobile ? 'text-center' : ''}`}
              >
                <div className="medium mb-3">Claim stats</div>
                <div className="grey">Tokens claimed</div>
                <div className="mb-4">
                  <span className="large">
                    {formatCurrency(distributorInitialOgv - burnAmount, 0)}
                  </span>
                  <span className="small">{' OGV'}</span>
                  <span className="grey">{` (${formatCurrency(
                    ((distributorInitialOgv - burnAmount) * 100) /
                      distributorInitialOgv,
                    2
                  )}%)`}</span>
                  &#42;
                </div>
                <div className={`d-flex layout`}>
                  <div className={`mr-lg-5 mr-md-3 ${isMobile ? 'mb-3' : ''}`}>
                    <div className="text-container grey">OGN holders</div>
                    <span className="medium">
                      {formatCurrency(
                        optionalDistributorInitialOgv - optionalLockupBalance,
                        0
                      )}
                    </span>
                    <span className="small">{' OGV'}</span>
                    <div className="grey">{`(${formatCurrency(
                      ((optionalDistributorInitialOgv - optionalLockupBalance) /
                        optionalDistributorInitialOgv) *
                        100,
                      2
                    )}%)`}</div>
                  </div>
                  <div>
                    <div className="text-container grey">OUSD holders</div>
                    <span className="medium">
                      {formatCurrency(
                        mandatoryDistributorInitialOgv - mandatoryLockupBalance,
                        0
                      )}
                    </span>
                    <span className="small">{' OGV'}</span>
                    <div className="grey">{`(${formatCurrency(
                      ((mandatoryDistributorInitialOgv -
                        mandatoryLockupBalance) /
                        mandatoryDistributorInitialOgv) *
                        100,
                      2
                    )}%)`}</div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`info-box stake d-flex layout ${
                isMobile ? 'text-center' : ''
              }`}
            >
              <div>
                <div className="medium mb-4">Staking stats</div>
                <div className="d-flex layout">
                  <div className={`mr-lg-5 mr-md-4 ${isMobile ? 'mb-3' : ''}`}>
                    <div className="text-container grey">Total staked</div>
                    <span className="large">
                      {formatCurrency(totalStaked, 0)}
                    </span>
                    <span className="small">{' OGV'}</span>
                  </div>
                  <div className={`ml-lg-3 ${isMobile ? 'mb-3' : ''}`}>
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
                  )}% `}</span>
                  <span className="small">{' APY'}</span>
                </div>
                <div>
                  <a
                    href="https://governance.ousd.com/stake"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button gradient1"
                  >
                    Stake OGV
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="footnote">
            &#42; 306,217,404 OGV were sent to exchanges whose customers were
            eligible for the airdrop. These exchanges are expected to burn any
            unclaimed tokens at the end of the claim period.
          </div>
        </div>
      </section>
      <style jsx>{`
        header {
          background-color: #141519;
        }

        section.burn {
          background-image: url(/images/flame.svg);
          background-repeat: no-repeat;
          background-position: 100% -5%;
          background-size: 70vw;
          padding-top: 0px;
        }

        h1 {
          color: fafbfb;
          font-family: Poppins;
          font-size: 6rem;
          font-weight: 500;
          margin-top: 10px;
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
          margin: 10px auto 0 auto;
          padding: 15px 0px;
          text-align: center;
          width: 100%;
        }

        .layout {
          flex-direction: row;
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

        .small {
          font-size: 0.875rem;
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

          section.burn {
            background-position: 100% 0%;
            background-size: 80vw;
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
          .info-box {
            width: 100% !important;
            margin-left: 0;
            margin-right: 0;
          }

          .stats {
            margin: 50px auto 0 auto;
            width: 100%;
          }

          .info-box.airdrop {
            background-size: 40vw;
          }

          .apy {
            align-self: normal;
            margin: 0;
          }

          section.burn {
            background-position: 100% 0%;
            background-size: 90vw;
          }

          .container {
            padding-left: 30px;
            padding-right: 30px;
          }

          .layout {
            flex-direction: column;
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

          .ogv-logo {
            width: 15%;
            margin-bottom: 2vw;
          }
        }
      `}</style>
    </Layout>
  )
}

export async function getStaticProps() {
  const navRes = await fetchAPI('/ousd-nav-links', {
    populate: {
      links: {
        populate: '*',
      },
    },
  })

  const navLinks = transformLinks(navRes.data)

  return {
    props: {
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  }
}

export default withIsMobile(Burn)
