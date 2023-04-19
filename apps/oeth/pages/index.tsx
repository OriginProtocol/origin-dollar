import { Header } from '@originprotocol/origin-storybook';
import {
  Faq,
  Hero,
  Wallet,
  SecretSauce,
  Ogv,
  Apy,
  Allocation,
  Collateral,
  Security,
} from '../src/sections';
import {
  fetchAPI,
  fetchAllocation,
  fetchApy,
  fetchApyHistory,
  fetchCollateral,
  fetchOgvStats,
  transformLinks,
} from '../src/utils';
import {
  ApyHistory,
  FaqData,
  Link as LinkType,
  OgvStats,
  Strategies,
  Collateral as CollateralType,
  Audit,
} from '../types';
import { Footer } from '../src/components';
import { zipObject } from 'lodash';
import { apyDayOptions } from '../constants';

interface IndexPageProps {
  audits: Audit[];
  apy: number[];
  apyHistory: ApyHistory;
  faq: FaqData[];
  stats: OgvStats;
  strategies: Strategies;
  collateral: CollateralType[];
  navLinks: LinkType[];
}

const IndexPage = ({
  audits,
  apy,
  apyHistory,
  faq,
  stats,
  strategies,
  collateral,
  navLinks,
}: IndexPageProps) => {
  const apyOptions = apy;
  const daysToApy = zipObject(apyDayOptions, apyOptions);

  return (
    <>
      <Header
        webProperty="oeth"
        mappedLinks={navLinks}
        background="bg-origin-bg-black"
      />

      <Hero />

      <Wallet />

      {process.env.NEXT_PUBLIC_UNREADY_COMPONENTS && (
        <>
          <Apy daysToApy={daysToApy} apyData={apyHistory} />

          <Allocation strategies={strategies} />

          <Collateral strategies={strategies} collateral={collateral} />

          <Security audits={audits} />

          <SecretSauce />

          <Ogv stats={stats} />
        </>
      )}

      <Faq faq={faq} />

      <Footer />
    </>
  );
};

export async function getStaticProps() {
  const apyHistory = await fetchApyHistory();
  const allocation = await fetchAllocation();
  const apy = await fetchApy();
  const collateral = await fetchCollateral();
  const faqRes: { data: FaqData[] } = await fetchAPI('/oeth-faqs');
  const ogvStats = await fetchOgvStats();
  const navRes = await fetchAPI('/oeth-nav-links', {
    populate: {
      links: {
        populate: '*',
      },
    },
  });

  const auditsRes = await fetchAPI('/oeth-audits');

  const navLinks = transformLinks(navRes.data);

  const faqData = faqRes?.data.sort((a, b) => a.id - b.id) || [];

  return {
    props: {
      audits: auditsRes.data,
      apy,
      apyHistory,
      faq: faqData,
      stats: ogvStats,
      strategies: allocation.strategies,
      collateral: collateral.collateral,
      navLinks,
    },
    revalidate: 60 * 5,
  };
}

export default IndexPage;
