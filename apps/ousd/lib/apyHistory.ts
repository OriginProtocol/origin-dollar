export async function fetchApyHistory() {
  const apyDayOptions = [7, 30, 365];
  const apyHistory = await Promise.all(
    apyDayOptions.map(async (days) => {
      const endpoint = `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v1/apr/trailing_history/${days}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${days}-day trailing APY history`);
      }
      const json = await response.json();
      return json.trailing_history;
    })
  ).catch(function (err) {
    console.log(err.message);
  });
  const data = {};
  apyDayOptions.map((days, i) => {
    data[`apy${days}`] = apyHistory ? apyHistory[i] : [];
  });
  return data;
}
