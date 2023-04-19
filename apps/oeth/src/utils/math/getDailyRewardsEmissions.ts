// APY calculating function from ousd-governance
const getDailyRewardsEmissions = (time = Date.now() / 1000) => {
  // format: start_timestamp, end_timestamp, daily emissions
  const data = [
    [
      //[31337, 4].includes(parseInt(process.env.NETWORK_ID)) ? 0 : 1657584000,
      0, 1660176000, 3333333,
    ],
    [1660176000, 1665360000, 2666667],
    [1665360000, 1675728000, 1866667],
    [1675728000, 1696464000, 1120000],
    [1696464000, 1727568000, 560000],
    [1727568000, 1779408000, 224000],
    [1779408000, 1862352000, 67200],
  ];

  const reward = data.find(
    ([startTime, endTime, dailyRewards]) => time > startTime && time < endTime
  );

  // 0 when rewards period has already finished
  return reward ? reward[2] : 0;
};

export default getDailyRewardsEmissions;
