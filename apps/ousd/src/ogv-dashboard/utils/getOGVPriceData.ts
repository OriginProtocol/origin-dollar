import { ChartTime, OgvRawData } from "../types";

// Probably would be better to use the pullstate store
const ogvPriceCache: Record<
  ChartTime,
  (OgvRawData & { lastUpdated?: number }) | undefined
> = {
  "1": undefined,
  "7": undefined,
  "30": undefined,
  "365": undefined,
}; // on client AND server

const ttls: Record<ChartTime, number> = {
  "1": 1000 * 60 * 5, // 5min
  "7": 1000 * 60 * 60 * 2, // 2hr
  "30": 1000 * 60 * 60 * 24, // 1day
  "365": 1000 * 60 * 60 * 24, // 1day
};

export const setCacheData = (key: ChartTime, value: OgvRawData) => {
  ogvPriceCache[key] = value;
};

const isServer = typeof window === "undefined";

const getOGVPriceData = async (days: number) => {
  let labels;
  let prices;
  let marketCaps;

  // If an entry exists, and are we are on the client, return it. If we are on
  // the server, check if the entry is stale.
  if (
    ogvPriceCache[days] &&
    (!isServer || Date.now() < ogvPriceCache[days]!.lastUpdated! + ttls[days])
  ) {
    return ogvPriceCache[days];
  }

  const rawData = await fetchOGVPriceData(days);
  labels = rawData.prices.map((price: any) => price[0]);

  prices = rawData.prices.map((price: any) => price[1]);
  // Since coingecko is providing incorrect data, we will calculate market cap
  // manually from the price
  marketCaps = []; // rawData.market_caps.map((price: any) => price[1]);

  ogvPriceCache[days] = {
    labels,
    prices,
    marketCaps,
    lastUpdated: isServer ? Date.now() : undefined,
  };

  return { labels, prices, marketCaps };
};

const fetchOGVPriceData = async (
  days: number
): Promise<{
  prices: number[];
  market_caps: number[];
  total_volumes: number[];
}> => {
  return await (
    await fetch(
      `https://api.coingecko.com/api/v3/coins/origin-dollar-governance/market_chart?vs_currency=usd&days=${days}`
    )
  ).json();
};

export default getOGVPriceData;
