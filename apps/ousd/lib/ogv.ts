export async function fetchOgvStats() {
  const endpoints = [
    `${process.env.NEXT_PUBLIC_COINGECKO_API}/simple/price?ids=origin-dollar-governance&vs_currencies=usd`,
    `${process.env.NEXT_PUBLIC_WEBSITE_API}/circulating-ogv`,
    `${process.env.NEXT_PUBLIC_WEBSITE_API}/total-ogv`,
  ];
  return Promise.all(
    endpoints.map(async (endpoint) => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        return {};
      }
      return await response.json();
    })
  );
}
