import React from "react";
import Head from "next/head";
import Allocation from "../src/components/Allocation";
import formatSeo from "../src/utils/seo";
import transformLinks from "../src/utils/transformLinks";
import Collateral from "../src/components/Collateral";
import Footer from "../src/components/Footer";
import Seo from "../src/components/strapi/seo";
import capitalize from "lodash/capitalize";
import {
  Hero,
  Apy,
  SecretSauce,
  Security,
  Faq,
  Ogv,
} from "../src/homepage/sections";
import { useRouter } from "next/router";
import { fetchAPI } from "../lib/api";
import { fetchApy } from "../lib/apy";
import { fetchApyHistory } from "../lib/apyHistory";
import { fetchAllocation } from "../lib/allocation";
import { fetchCollateral } from "../lib/collateral";
import { fetchOgvStats } from "../src/utils";
import { Header } from "@originprotocol/origin-storybook";
import { setupContracts, fetchTvl } from "../src/utils/contracts";
import {
  Audit,
  FaqData,
  ApyHistory,
  Strategies,
  Collateral as CollateralType,
  OgvStats,
} from "../src/homepage/types";
import { PageSeo as SeoType, Link as LinkType } from "../src/types";
import { zipObject } from "lodash";
import { apyDayOptions } from "../src/utils/constants";

interface HomeProps {
  audits: Audit[];
  seo: SeoType;
  navLinks: LinkType[];
  faq: FaqData[];
  apy: number[];
  apyHistory: ApyHistory;
  strategies: Strategies;
  collateral: CollateralType[];
  initialTvl: number;
  ogvStats: OgvStats;
}

const sectionOverrideCss = "px-4 sm:px-4 md:px-4 lg:px-10";

const Home = ({
  audits,
  seo,
  navLinks,
  faq,
  apy,
  apyHistory,
  strategies,
  collateral,
  initialTvl,
  ogvStats,
}: HomeProps) => {
  const { pathname } = useRouter();
  const active = capitalize(pathname.slice(1));

  const apyOptions = apy;
  const daysToApy = zipObject(apyDayOptions, apyOptions);
  return (
    <>
      <Head>
        <title>Origin Dollar</title>
      </Head>
      <Seo seo={seo} />

      <Header
        className={sectionOverrideCss}
        mappedLinks={navLinks}
        webProperty="ousd"
        active={active}
      />
      <Hero
        daysToApy={daysToApy}
        initialTvl={initialTvl}
        sectionOverrideCss={sectionOverrideCss}
      />
      <Apy daysToApy={daysToApy} apyData={apyHistory} />
      <Allocation strategies={strategies} />
      <Collateral collateral={collateral} strategies={strategies} />
      <Security audits={audits} sectionOverrideCss={sectionOverrideCss} />
      <SecretSauce />
      <Ogv stats={ogvStats} />
      <Faq faq={faq} />
      <Footer />
    </>
  );
};

export async function getStaticProps() {
  const { vault, dripper } = setupContracts();
  const initialTvl = await fetchTvl(vault, dripper);
  const apyHistory = await fetchApyHistory();
  const apy = await fetchApy();
  const allocation = await fetchAllocation();
  const collateral = await fetchCollateral();
  const ogvStats = await fetchOgvStats();

  const auditsRes = await fetchAPI("/ousd-audits");

  const faqRes: { data: FaqData[] } = await fetchAPI("/ousd-faqs");
  const seoRes = await fetchAPI("/ousd/page/en/%2F");
  const navRes = await fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const navLinks = transformLinks(navRes.data);

  const faqData = faqRes?.data.sort((a, b) => a.id - b.id) || [];

  return {
    props: {
      audits: auditsRes.data,
      seo: formatSeo(seoRes?.data),
      navLinks,
      faq: faqData,
      initialTvl,
      apy,
      apyHistory: apyHistory || [],
      strategies: allocation.strategies,
      collateral: collateral.collateral,
      ogvStats,
    },
    revalidate: 60 * 15, // Cache response for 15m
  };
}

export default Home;
