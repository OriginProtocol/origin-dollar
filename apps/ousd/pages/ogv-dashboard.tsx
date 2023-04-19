import "chartjs-adapter-date-fns";
import { Header } from "@originprotocol/origin-storybook";
import { GetStaticProps } from "next";
import { fetchAPI } from "../lib/api";
import Seo from "../src/components/strapi/seo";
import formatSeo from "../src/utils/seo";
import transformLinks from "../src/utils/transformLinks";
import Head from "next/head";
import Footer from "../src/components/Footer";
import {
  Chart as ChartJS,
  CategoryScale,
  PointElement,
  LineElement,
  LinearScale,
  Title,
  Tooltip,
  TimeScale,
  ArcElement,
  RadialLinearScale,
  ChartData,
  Point,
} from "chart.js";
import { useViewWidth, useOgv } from "../src/hooks";
import ogvAbi from "../src/constants/mainnetAbi/ogv.json";
import { ChartLine, DistributionLegend } from "../src/plugins";
import { BigNumber, ethers, providers } from "ethers";
import { getRewardsApy } from "../src/utils/math";
import { Link, PageSeo } from "../src/types";
import { DashProps } from "../src/ogv-dashboard/types";
import {
  doughnutData,
  nonCirculatingSupply as nonCirculating,
} from "../src/ogv-dashboard/data";
import {
  get24HChartData,
  fetchOGVStakingData,
  getStakingChartData,
  getOGVPriceData,
  calculateCirculatingSupply,
  calculateMarketCap,
} from "../src/ogv-dashboard/utils";
import {
  Heading,
  OgvPriceStats,
  OgvPriceChart,
  StakingBanner,
  AllocationDistribution,
  TopExchanges,
  OgvStakingStats,
} from "../src/ogv-dashboard/sections";
import { fetchOgvStats } from "../src/utils";
import { stakingDecayFactor } from "../src/constants";

ChartJS.register(
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  ArcElement,
  ChartLine,
  DistributionLegend("distributionLegend"),
  RadialLinearScale
);

const ogvStakingCache: {
  data?: ChartData<"line", (number | Point)[], unknown>;
  lastUpdated?: number;
  ttl: number;
} = {
  ttl: 60 * 60 * 24 * 1000,
}; //on server

// Dependency flow: constants, types -> chart-configs, data, utils -> components -> sections -> index.tsx (this file)

const OgvDashboard = ({
  seo,
  navLinks,
  priceData24H,
  marketCapData24H,
  rawData7D,
  rawData30D,
  rawData365D,
  stakingData,
  currentPrice,
  currentMarketCap,
  change24H,
  totalSupply,
  doughnutData,
  nonCirculatingSupply,
}: DashProps) => {
  const width = useViewWidth();

  const { totalVeSupply } = useOgv();
  const stakingApy =
    getRewardsApy(
      100 * stakingDecayFactor ** (48 / 12),
      100,
      parseFloat(totalVeSupply)
    ) || 0;

  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      <Seo seo={seo} />
      <Header mappedLinks={navLinks} webProperty="ousd" />

      {/* Heading */}
      <Heading stakingApy={stakingApy} />

      {/* General OGV Price Stats */}
      <OgvPriceStats
        {...{
          currentPrice,
          currentMarketCap,
          change24H,
          totalSupply,
          nonCirculatingSupply,
        }}
      />

      {/* OGV Price Chart */}
      <OgvPriceChart
        {...{
          priceData24H,
          marketCapData24H,
          rawData7D,
          rawData30D,
          rawData365D,
          width,
        }}
      />

      {/* OGV Staking Banner*/}
      <StakingBanner {...{ stakingApy, width }} />

      {/* OGV Staking Stats */}
      <OgvStakingStats stakingData={stakingData} />

      {/* OGV Allocation Distribution */}
      <AllocationDistribution doughnutData={doughnutData} />

      {/* Listed on top exchanges */}
      <TopExchanges />

      {/* Always takes up width of full screen */}
      <Footer />
    </>
  );
};

export const getStaticProps: GetStaticProps = async (): Promise<{
  props: DashProps;
  revalidate: number;
}> => {
  const seoResPromise = fetchAPI("/ousd/page/en/%2Fogv-dashboard");
  const navResPromise = fetchAPI("/ousd-nav-links", {
    populate: {
      links: {
        populate: "*",
      },
    },
  });

  const rawData24HPromise = getOGVPriceData(1);
  const rawData7DPromise = getOGVPriceData(7);
  const rawData30DPromise = getOGVPriceData(30);
  const rawData365DPromise = getOGVPriceData(365);

  const ogvStatsPromise = fetchOgvStats();

  const provider = new providers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER
  );
  const OGV = new ethers.Contract(
    "0x9c354503c38481a7a7a51629142963f98ecc12d0",
    ogvAbi,
    provider
  );

  const days = 90;
  const ethBlocksPerDay = 5760;
  const currentBlock = await provider.getBlockNumber();
  const ogvContractAddress = "0x9c354503C38481a7A7a51629142963F98eCC12D0";

  // The slot number of OGVStaking.sol's OGV balance
  // slither-read-storage 0x7DFAFe7d547Fc9083719D633B9c5f6f542C42c77
  // --variable-name _balances --key 0x0C4576Ca1c365868E162554AF8e385dc3e7C66D9
  // --storage-address 0x9c354503C38481a7A7a51629142963F98eCC12D0 --rpc-url
  // [YOUR_RPC_URL]
  const stakingContractOgvBalanceSlot = BigNumber.from(
    "53374832710725341261650961104440469343146346525711704527343957115373724579195"
  );

  // The slot number of OGV's total supply
  // slither-read-storage 0x7DFAFe7d547Fc9083719D633B9c5f6f542C42c77
  // --variable-name _totalSupply --key 0x0C4576Ca1c365868E162554AF8e385dc3e7C66D9
  // --storage-address 0x9c354503C38481a7A7a51629142963F98eCC12D0 --rpc-url
  // [YOUR_RPC_URL]
  const ogvTotalSupplySlot = BigNumber.from("53");

  const rawStakingDataPromise = fetchOGVStakingData(
    days,
    ethBlocksPerDay,
    currentBlock,
    ogvContractAddress,
    stakingContractOgvBalanceSlot,
    ogvTotalSupplySlot
  );

  const totalSupplyPromise: Promise<BigNumber> = OGV.totalSupply();

  let [
    seoRes,
    navRes,
    rawData24H,
    rawData7D,
    rawData30D,
    rawData365D,
    ogvStats,
    totalSupply,
    rawStakingData,
    ...nonCirculatingBalances
  ] = await Promise.all([
    seoResPromise,
    navResPromise,
    rawData24HPromise,
    rawData7DPromise,
    rawData30DPromise,
    rawData365DPromise,
    ogvStatsPromise,
    totalSupplyPromise,
    rawStakingDataPromise,
    ...nonCirculating.map((e) => OGV.balanceOf(e.address)),
  ]);

  const nonCirculatingSupply = nonCirculating.map((e, i) => ({
    ...e,
    balance: nonCirculatingBalances[i].toString(),
  }));

  const seo: PageSeo = formatSeo(seoRes?.data) as PageSeo;
  const navLinks: Link[] = transformLinks(navRes.data) as Link[];

  const { price: currentPrice, change24H } = ogvStats;

  const circulatingSupply = calculateCirculatingSupply(
    totalSupply,
    nonCirculatingSupply
  );

  // Calculate market cap
  rawData24H.marketCaps = rawData24H.prices.map((p: number) =>
    calculateMarketCap(circulatingSupply, p)
  );
  rawData7D.marketCaps = rawData7D.prices.map((p: number) =>
    calculateMarketCap(circulatingSupply, p)
  );
  rawData30D.marketCaps = rawData30D.prices.map((p: number) =>
    calculateMarketCap(circulatingSupply, p)
  );
  rawData365D.marketCaps = rawData365D.prices.map((p: number) =>
    calculateMarketCap(circulatingSupply, p)
  );

  const { priceData24H, marketCapData24H } = get24HChartData(rawData24H);

  const currentMarketCap = calculateMarketCap(circulatingSupply, currentPrice);

  const { lastUpdated, data, ttl } = ogvStakingCache;

  // 24HR ttl
  const cacheHit = lastUpdated ? Date.now() < lastUpdated + ttl : false;
  let stakingData: ChartData<"line", (number | Point)[], unknown>;
  if (cacheHit) stakingData = data;
  else {
    stakingData = getStakingChartData(rawStakingData, days);
    ogvStakingCache.lastUpdated = Date.now();
    ogvStakingCache.data = stakingData;
  }

  return {
    props: {
      seo,
      navLinks,
      priceData24H,
      marketCapData24H,
      rawData7D,
      rawData30D,
      rawData365D,
      stakingData,
      currentPrice,
      currentMarketCap,
      change24H,
      totalSupply: totalSupply.toString(),
      doughnutData,
      nonCirculatingSupply,
    },
    revalidate: 60 * 15,
  };
};

export default OgvDashboard;
