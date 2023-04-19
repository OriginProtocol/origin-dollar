export const formatCurrencyAbbreviated = (num, decimalDigits) => {
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });
  return item
    ? (num / item.value).toFixed(decimalDigits).replace(rx, "$1") + item.symbol
    : "0";
};

export const formatCurrency = (value, decimals, truncate = true) => {
  // avoid false formatting of e - notated numbers
  if (value < Math.pow(10, decimals * -1)) {
    value = 0;
  }

  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: typeof decimals === "number" ? decimals : 2,
    maxDecimals: typeof decimals === "number" ? decimals : 5,
    truncate,
  });
};

export const formatPercentage = (decimal: number, decimals = 2): string =>
  `${(decimal * 100).toFixed(decimals)}%`;

export const rounded = (value, decimals = 0, truncate = true) => {
  if (value > 1000000)
    return formatCurrency(value / 1000000, decimals, truncate) + "m";
  if (value > 1000)
    return formatCurrency(value / 1000, decimals, truncate) + "k";
  if (value < 0.01) return formatCurrency(value, 0, truncate);
  return formatCurrency(value, decimals, truncate);
};

export const aprToApy = (apr, aprDays) => {
  const periodsPerYear = 365.25 / aprDays;
  return Math.pow(1 + apr / 100 / periodsPerYear, periodsPerYear) - 1;
};

export const formatCurrencyMinMaxDecimals = (
  value,
  { minDecimals, maxDecimals, truncate, floorInsteadOfRound = false }
) => {
  if (value === "") {
    return "0.00";
  } else if (Number.isNaN(parseFloat(value))) {
    return "0.00";
  }

  let valueToUse = value;
  if (truncate) {
    valueToUse = truncateDecimals(value, maxDecimals);
  } else if (floorInsteadOfRound) {
    valueToUse =
      Math.floor(parseFloat(value) * Math.pow(10, maxDecimals)) /
      Math.pow(10, maxDecimals);
  }
  const options = {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  };

  return parseFloat(valueToUse).toLocaleString("en", options);
};

/**
 * Takes a number and truncates decimals values and
 * returns it as a string
 *
 * @param {String|Number} value Value to truncate
 * @param {Number} decimals Number of decimals to truncate to
 *
 * @returns {String} Truncated decimal value
 */
export const truncateDecimals = (value, decimals = 6) => {
  if (!value) return value;
  const [whole, fraction] = value.toString().split(".");

  if (!fraction || fraction.length <= decimals) {
    // No change
    return value.toString();
  }

  // truncate decimals & return
  return `${whole}.${fraction.slice(0, decimals)}`;
};

// APY calculating function from ousd-governance
export const getDailyRewardsEmissions = (time = Date.now() / 1000) => {
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

export const getRewardsApy = (veOgvReceived, ogvToStake, totalSupplyVeOgv) => {
  if (totalSupplyVeOgv === 0 || ogvToStake === 0 || veOgvReceived === 0) {
    return 0;
  }

  const ogvPercentageOfRewards =
    veOgvReceived / (totalSupplyVeOgv + veOgvReceived);
  const dailyEmissions = getDailyRewardsEmissions();
  if (dailyEmissions === 0) {
    console.warn(
      "Reason for APY 0% -> no reward emissions for current timestamp."
    );
  }
  const ogvRewardsDaily = dailyEmissions * ogvPercentageOfRewards;
  const ogvRewardsYearly = ogvRewardsDaily * 365.25; // accounting for leap year
  // No need to use actual prices since originating tokens and reward tokens have the same price
  const ogvLockupRewardApr = ogvRewardsYearly / ogvToStake;

  /* APR to APY formula:
   * APY = Math.pow((1 + Periodic Rate), Number of periods) – 1
   *
   * picking 1 (1 year) as a number of periods. Since the rewards are not really going to be
   * compounding in this case
   */
  return ((1 + ogvLockupRewardApr / 1) ** 1 - 1) * 100;
};
