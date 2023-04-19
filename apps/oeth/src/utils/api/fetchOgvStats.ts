import { get } from "lodash";

const fetchOgvStats = async () => {
  const endpoints = [
    `${process.env.CMC_API}/v2/cryptocurrency/quotes/latest?symbol=ogv`,
    `${process.env.NEXT_PUBLIC_WEBSITE_API}/circulating-ogv`,
    `${process.env.NEXT_PUBLIC_WEBSITE_API}/total-ogv`,
  ];
  const ogvStats = await Promise.all(
    endpoints.map(async (endpoint) => {
      const response = await fetch(endpoint, {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
        },
      });
      if (!response.ok) {
        return [];
      }
      return await response.json();
    })
  );

  return {
    price: get(ogvStats, "[0].data.OGV[0].quote.USD.price")
      ? get(ogvStats, "[0].data.OGV[0].quote.USD.price")
      : 0,
    change24H: get(ogvStats, "[0].data.OGV[0].quote.USD.percent_change_24h")
      ? get(ogvStats, "[0].data.OGV[0].quote.USD.percent_change_24h")
      : 0,
    circulatingSupply: ogvStats[1],
    totalSupply: ogvStats[2],
  };
};

export default fetchOgvStats;
