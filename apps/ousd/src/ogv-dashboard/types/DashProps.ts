import { Link, PageSeo } from "../../types";
import OgvRawData from "./OgvRawData";
import { ChartData } from "chart.js";

interface DashProps {
  seo: PageSeo,
  navLinks: Link[];
  priceData24H: ChartData<"line", number[], number>;
  marketCapData24H: ChartData<"line", number[], number>;
  rawData7D: OgvRawData;
  rawData30D: OgvRawData;
  rawData365D: OgvRawData;
  stakingData: ChartData<"line">;
  currentPrice: number;
  currentMarketCap: number;
  change24H: number;
  totalSupply: string;
  doughnutData: ChartData<"doughnut">;
  nonCirculatingSupply: {
    address: string;
    internalLabel: string;
    publicLabel: string;
    balance: string;
  }[];
}

export default DashProps;
