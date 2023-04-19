/* tslint:disable */
import React from "react";
import Image from "next/image";
import Link from "next/link";
import Head from "next/head";
import { Typography, Header } from "@originprotocol/origin-storybook";
import Seo from "../src/components/strapi/seo";
import formatSeo from "../src/utils/seo";
import Footer from "../src/components/Footer";
import { formatCurrency, getRewardsApy } from "../src/utils/math";
import { assetRootPath } from "../src/utils/image";
import withIsMobile from "../src/hoc/withIsMobile";
import { fetchAPI } from "../lib/api";
import transformLinks from "../src/utils/transformLinks";
import { useOgv } from "../src/hooks";

const Burn = ({ locale, onLocale, seo, navLinks }) => {
  const {
    totalStaked,
    totalSupply,
    totalVeSupply,
    optionalLockupBalance,
    mandatoryLockupBalance,
  } = useOgv();

  const mandatoryDistributorInitialOgv = 398752449;
  const optionalDistributorInitialOgv = 747905084;
  const distributorInitialOgv =
    mandatoryDistributorInitialOgv + optionalDistributorInitialOgv;

  const initialSupply = 4000000000;
  const airdropAllocationOgn = 1000000000;
  const airdropAllocationOusd = 450000000;
  const airdropAllocation = airdropAllocationOgn + airdropAllocationOusd;
  const burnedAmount = 369658070;

  const stakingApy =
    getRewardsApy(100 * 1.8 ** (48 / 12), 100, parseFloat(totalVeSupply)) || 0;

  // @ts-ignore
  return (
    <>
      <Head>
        <title>Burn</title>
      </Head>
      <Seo seo={seo} />
      <section className="burn black">
        <Header mappedLinks={navLinks} webProperty="ousd" />
        <div className="px-8 md:px-16 lg:px-[134px] pb-14 md:pb-[120px] text-left">
          <div className="max-w-[1432px] mx-auto flex flex-col">
            <Typography.H2
              className="flex flex-row items-center space-x-4 mt-[20px] lg:mt-16 text-[40px] md:text-[64px] leading-[40px] md:leading-[72px]"
              style={{ fontWeight: 700 }}
            >
              <Image
                src={assetRootPath("/images/ogv-logo.svg")}
                width="96"
                height="96"
                className="w-10 md:w-24"
                alt="OGV logo"
              />
              <div>OGV BURN</div>
            </Typography.H2>
            <Typography.H3 className="mt-4 max-w-[734px] text-[16px] md:text-[24px] leading-[28px] md:leading-[32px]">
              On October 10th, 2022 at 0:00UTC all unclaimed tokens from the OGV
              airdrop were burned forever.
            </Typography.H3>
            <Typography.H2
              className="mt-14 md:mt-[120px] text-gradient1 text-[48px] md:text-[128px] leading-[48px] md:leading-[150px]"
              style={{ fontWeight: 700 }}
            >
              Burn complete!
            </Typography.H2>
            <div className="flex flex-col md:flex-row space-y-4 md:space-x-6 md:space-y-0 mt-10">
              <Link
                href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-[267px] ml-0 px-20 py-3.5 md:py-5 rounded-full text-center gradient2 hover:opacity-90"
              >
                <Typography.Body>Buy OGV</Typography.Body>
              </Link>
              <Link
                href="https://governance.ousd.com/stake"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-[267px] px-20 py-3.5 md:py-5 rounded-full text-center border-[1px] hover:opacity-90"
              >
                <Typography.Body>Stake OGV</Typography.Body>
              </Link>
            </div>
            <Typography.H3 className="mt-14 md:mt-[120px] max-w-[734px] text-[16px] md:text-[24px] leading-[28px] md:leading-[32px]">
              OGV burned
            </Typography.H3>
            <Typography.H2
              className="mt-4 md:mt-2 text-[56px] md:text-[128px] leading-[64px] md:leading-[150px]"
              style={{ fontWeight: 700 }}
            >
              {formatCurrency(burnedAmount, 0)}
            </Typography.H2>
            <Typography.H3
              className="mt-1 md:mt-2 text-[24px] md:text-[40px] leading-[32px] md:leading-[40px]"
              style={{ fontWeight: 400 }}
            >
              <span className="text-gradient1 font-bold inline-block">
                {`${formatCurrency((burnedAmount / initialSupply) * 100, 2)}%`}
                <div className="mt-1 md:mt-2 h-1 gradient1 rounded-full"></div>
              </span>
              {" of initial supply"}
            </Typography.H3>
            <div className="flex flex-col md:flex-row mt-8 md:mt-10 space-y-2 md:space-x-10 md:space-y-0">
              <Link
                href={
                  "https://etherscan.io/address/0x7ae2334f12a449895ad21d4c255d9de194fe986f"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row space-x-2"
              >
                <div
                  className="text-[16px] leading-[28px] text-gradient2"
                  style={{ fontWeight: 700 }}
                >
                  Liquid OGV airdrop contract
                </div>
                <Image
                  src={assetRootPath("/images/external-link.svg")}
                  width="16"
                  height="16"
                  alt="External link"
                />
              </Link>
              <Link
                href={
                  "https://etherscan.io/address/0xd667091c2d1dcc8620f4eaea254cdfb0a176718d"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row space-x-2"
              >
                <div
                  className="text-[16px] leading-[28px] text-gradient2"
                  style={{ fontWeight: 700 }}
                >
                  Locked OGV airdrop contract
                </div>
                <Image
                  src={assetRootPath("/images/external-link.svg")}
                  width="16"
                  height="16"
                  alt="External link"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#1e1f25]">
        <div className="px-8 md:px-16 lg:px-[134px] pt-14 md:pt-[120px] pb-20 md:pb-[132px]">
          <div className="max-w-[1432px] mx-auto">
            <Typography.H3 className="text-[16px] md:text-[24px] leading-[28px] md:leading-[32px]">
              The OGV airdrop
            </Typography.H3>
            <Typography.Body3
              className="max-w-[943px] mt-3 md:mt-4 text-[14px] md:text-[20px] leading-[23px] md:leading-[36px] text-subheading"
              style={{ fontWeight: 400 }}
            >
              As of July 12th, over 40,000 OGN holders and all OUSD holders
              became eligible to claim OGV, the new governance token for Origin
              Dollar. OGV accrues staking rewards, fees, and voting power when
              staked for one month or longer. The claim period for this airdrop
              ran for 90 days, after which all remaining tokens held in the
              distributor contracts were burned. Centralized exchanges have been
              instructed to burn additional unclaimed tokens held in their
              accounts. Additional supply reductions occur through periodic
              automated buybacks funded by yield from OUSD.
            </Typography.Body3>
            <Link
              href={
                "https://blog.originprotocol.com/tokenomics-retroactive-rewards-and-prelaunch-liquidity-mining-campaign-for-ogv-1b20b8ab41c8"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-row mt-3 md:mt-4 space-x-2"
            >
              <div
                className="text-[16px] leading-[28px] text-gradient2"
                style={{ fontWeight: 700 }}
              >
                Learn more
              </div>
              <Image
                src={assetRootPath("/images/external-link.svg")}
                width="16"
                height="16"
                alt="External link"
              />
            </Link>
            <div className="flex flex-col max-w-[1188px] mt-14 lg:mt-20 space-y-4">
              <div className="flex flex-col lg:flex-row justify-between space-y-4 lg:space-x-4 lg:space-y-0">
                <div className="airdrop lg:w-1/2 px-6 py-8 lg:p-10 bg-[#141519] rounded-[16px]">
                  <Typography.H4 className="text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                    Airdrop allocation stats
                  </Typography.H4>
                  <Typography.Body3 className="mt-4 lg:mt-8 text-[20px] leading-[36px] text-subheading">
                    Airdrop total
                  </Typography.Body3>
                  <div className="lg:mt-1 space-x-1.5">
                    <Typography.H4
                      className="inline-block text-[32px] leading-[36px]"
                      style={{ fontWeight: 700 }}
                    >
                      {formatCurrency(airdropAllocation, 0)}
                    </Typography.H4>
                    <Typography.Body
                      className="inline-block text-[16px] leading-[28px]"
                      style={{ fontWeight: 700 }}
                    >
                      {"OGV"}
                    </Typography.Body>
                  </div>
                  <div className="flex flex-col lg:flex-row mt-6 lg:mt-8 space-y-6 lg:space-x-3.5 lg:space-y-0">
                    <div>
                      <div className="flex flex-row space-x-2">
                        <Image
                          src={assetRootPath("/images/purple-dot-dark.svg")}
                          width="16"
                          height="16"
                          alt="Purple dot"
                        />
                        <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                          OGN holders
                        </Typography.Body3>
                      </div>
                      <div className="space-x-1.5">
                        <Typography.H4 className="inline-block text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                          {formatCurrency(airdropAllocationOgn, 0)}
                        </Typography.H4>
                        <Typography.Body
                          className="inline-block text-[16px] leading-[28px]"
                          style={{ fontWeight: 700 }}
                        >
                          {"OGV"}
                        </Typography.Body>
                      </div>
                      <Typography.Body3 className="text-[16px] leading-[28px] text-subheading">
                        (68.97%)
                      </Typography.Body3>
                    </div>
                    <div>
                      <div className="flex flex-row space-x-2">
                        <Image
                          src={assetRootPath("/images/purple-dot-light.svg")}
                          width="16"
                          height="16"
                          alt="Purple dot"
                        />
                        <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                          OUSD holders
                        </Typography.Body3>
                      </div>
                      <div className="space-x-1.5">
                        <Typography.H4 className="inline-block text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                          {formatCurrency(airdropAllocationOusd, 0)}
                        </Typography.H4>
                        <Typography.Body
                          className="inline-block text-[16px] leading-[28px]"
                          style={{ fontWeight: 700 }}
                        >
                          {"OGV"}
                        </Typography.Body>
                      </div>
                      <Typography.Body3 className="text-[16px] leading-[28px] text-subheading">
                        (31.03%)
                      </Typography.Body3>
                    </div>
                  </div>
                </div>
                <div className="lg:w-1/2 px-6 py-8 lg:p-10 bg-[#141519] rounded-[16px] text-center lg:text-left">
                  <Typography.H4 className="text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                    Claim stats
                  </Typography.H4>
                  <Typography.Body3 className="mt-4 lg:mt-8 text-[20px] leading-[36px] text-subheading">
                    Tokens claimed
                  </Typography.Body3>
                  <div className="mt-1 space-x-1.5">
                    <Typography.H4
                      className="inline-block text-[32px] leading-[36px]"
                      style={{ fontWeight: 700 }}
                    >
                      {formatCurrency(distributorInitialOgv - burnedAmount, 0)}
                    </Typography.H4>
                    <Typography.Body
                      className="inline-block text-[16px] leading-[28px]"
                      style={{ fontWeight: 700 }}
                    >
                      {"OGV"}
                    </Typography.Body>
                  </div>
                  <Typography.Body3 className="text-[16px] leading-[28px] text-subheading">
                    {`(${formatCurrency(
                      ((distributorInitialOgv - burnedAmount) * 100) /
                        distributorInitialOgv,
                      2
                    )}%)*`}
                  </Typography.Body3>
                  <div className="flex flex-col lg:flex-row mt-6 lg:mt-8 space-y-6 lg:space-x-10 lg:space-y-0">
                    <div>
                      <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                        OGN holders
                      </Typography.Body3>
                      <div className="space-x-1.5">
                        <Typography.H4 className="inline-block text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                          {formatCurrency(
                            optionalDistributorInitialOgv -
                              parseFloat(optionalLockupBalance),
                            0
                          )}
                        </Typography.H4>
                        <Typography.Body
                          className="inline-block text-[16px] leading-[28px]"
                          style={{ fontWeight: 700 }}
                        >
                          {"OGV"}
                        </Typography.Body>
                      </div>
                      <Typography.Body3 className="text-[16px] leading-[28px] text-subheading">
                        {`(${formatCurrency(
                          ((optionalDistributorInitialOgv -
                            parseFloat(optionalLockupBalance)) /
                            optionalDistributorInitialOgv) *
                            100,
                          2
                        )}% claimed)`}
                      </Typography.Body3>
                    </div>
                    <div>
                      <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                        OUSD holders
                      </Typography.Body3>
                      <div className="space-x-1.5">
                        <Typography.H4 className="inline-block text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                          {formatCurrency(
                            mandatoryDistributorInitialOgv -
                              parseFloat(mandatoryLockupBalance),
                            0
                          )}
                        </Typography.H4>
                        <Typography.Body
                          className="inline-block text-[16px] leading-[28px]"
                          style={{ fontWeight: 700 }}
                        >
                          {"OGV"}
                        </Typography.Body>
                      </div>
                      <Typography.Body3 className="text-[16px] leading-[28px] text-subheading">
                        {`(${formatCurrency(
                          ((mandatoryDistributorInitialOgv -
                            parseFloat(mandatoryLockupBalance)) /
                            mandatoryDistributorInitialOgv) *
                            100,
                          2
                        )}% claimed)`}
                      </Typography.Body3>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row justify-between px-6 py-8 lg:p-10 bg-[#141519] rounded-[16px]">
                <div className="lg:w-1/2 text-center lg:text-left">
                  <Typography.H4 className="text-[20px] lg:text-[24px] leading-[36px] lg:leading-[32px]">
                    Staking stats
                  </Typography.H4>
                  <div className="flex flex-col lg:flex-row justify-between mt-4 lg:mt-8 space-y-6 lg:space-y-0">
                    <div>
                      <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                        Total staked
                      </Typography.Body3>
                      <div className="mt-1 space-x-1.5">
                        <Typography.H4
                          className="inline-block text-[32px] leading-[36px]"
                          style={{ fontWeight: 700 }}
                        >
                          {formatCurrency(totalStaked, 0)}
                        </Typography.H4>
                        <Typography.Body
                          className="inline-block text-[16px] leading-[28px]"
                          style={{ fontWeight: 700 }}
                        >
                          {"OGV"}
                        </Typography.Body>
                      </div>
                    </div>
                    <div className="lg:pr-10">
                      <Typography.Body3 className="text-[20px] leading-[36px] text-subheading">
                        Percentage staked
                      </Typography.Body3>
                      <Typography.H4
                        className="mt-1 text-[32px] leading-[36px]"
                        style={{ fontWeight: 700 }}
                      >
                        {`${formatCurrency(
                          (parseFloat(totalStaked) / parseFloat(totalSupply)) *
                            100,
                          2
                        )}%`}
                      </Typography.H4>
                    </div>
                  </div>
                </div>
                <div className="lg:w-1/4 mt-10 lg:mt-0 text-center">
                  <div className="space-x-1.5">
                    <Typography.H4
                      className="inline-block text-[32px] leading-[36px]"
                      style={{ fontWeight: 700 }}
                    >
                      {`${formatCurrency(stakingApy, 2)}%`}
                    </Typography.H4>
                    <Typography.Body
                      className="inline-block text-[16px] leading-[28px]"
                      style={{ fontWeight: 700 }}
                    >
                      {"APY"}
                    </Typography.Body>
                  </div>
                  <Link
                    href="https://governance.ousd.com/stake"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full lg:max-w-[248px] mt-6 lg:mt-7 px-[60px] py-3.5 lg:py-5 rounded-full text-center gradient2 hover:opacity-90"
                  >
                    <Typography.Body>Stake OGV</Typography.Body>
                  </Link>
                </div>
              </div>
            </div>
            <div className="max-w-[1188px] mt-6 lg:mt-10">
              <Typography.Body3
                className="text-[14px] lg:text-[16px] leading-[23px] lg:leading-[28px]"
                style={{ fontWeight: 400 }}
              >
                * 306,217,404 OGV were sent to exchanges whose customers were
                eligible for the airdrop. These exchanges are expected to burn
                any unclaimed tokens at the end of the claim period.
              </Typography.Body3>
            </div>
          </div>
        </div>
      </section>
      <Footer />
      <style jsx>{`
        .airdrop {
          background-image: url(/images/pie-chart.svg);
          background-repeat: no-repeat;
          background-position: 100% 50%;
          background-size: 236px;
        }

        @media (max-width: 799px) {
          .airdrop {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </>
  );
};

export async function getStaticProps() {
  const seoRes = await fetchAPI("/ousd/page/en/%2Fburn");
  const navRes = await fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const navLinks = transformLinks(navRes.data);

  return {
    props: {
      seo: formatSeo(seoRes?.data),
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  };
}

export default withIsMobile(Burn);
