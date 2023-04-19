import formatCurrency from './formatCurrency';

const rounded = (value, decimals = 0, truncate = true) => {
  if (value > 1000000)
    return formatCurrency(value / 1000000, decimals, truncate) + 'm';
  if (value > 1000)
    return formatCurrency(value / 1000, decimals, truncate) + 'k';
  if (value < 0.01) return formatCurrency(value, 0, truncate);
  return formatCurrency(value, decimals, truncate);
};

export default rounded;
