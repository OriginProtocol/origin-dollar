const formatPercentage = (decimal: number, decimals = 2): string =>
  `${(decimal * 100).toFixed(decimals)}%`;

export default formatPercentage;
