import formatCurrencyMinMaxDecimals from './formatCurrencyMinMaxDecimals';

const formatCurrency = (value, decimals, truncate = true) => {
  // avoid false formatting of e - notated numbers
  if (value < Math.pow(10, decimals * -1)) {
    value = 0;
  }

  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: typeof decimals === 'number' ? decimals : 2,
    maxDecimals: typeof decimals === 'number' ? decimals : 5,
    truncate,
  });
};

export default formatCurrency;
