export async function fetchApy() {
  const apyDayOptions = [7, 30, 365];
  const dayResults = await Promise.all(
    apyDayOptions.map(async (days) => {
      const endpoint = `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v1/apr/trailing/${days}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${days} day APY`);
      }
      const json = await response.json();
      return json.apy / 100;
    })
  ).catch(function (err) {
    console.log(err.message);
  });
  return dayResults;
}
