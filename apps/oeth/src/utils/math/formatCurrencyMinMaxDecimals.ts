import truncateDecimals from './truncateDecimals';

const formatCurrencyMinMaxDecimals = (
  value,
  { minDecimals, maxDecimals, truncate, floorInsteadOfRound = false }
) => {
  if (value === '') {
    return '0.00';
  } else if (Number.isNaN(parseFloat(value))) {
    return '0.00';
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

  return parseFloat(valueToUse).toLocaleString('en', options);
};

export default formatCurrencyMinMaxDecimals;
