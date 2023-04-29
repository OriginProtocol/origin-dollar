/**
 * Takes a number and truncates decimals values and
 * returns it as a string
 *
 * @param {String|Number} value Value to truncate
 * @param {Number} decimals Number of decimals to truncate to
 *
 * @returns {String} Truncated decimal value
 */
export const truncateDecimals = (value: number, decimals = 6): string => {
  if (!value) return '';
  const [whole, fraction] = value.toString().split('.');
  if (!fraction || fraction.length <= decimals) {
    return value.toString();
  }
  return `${whole}.${fraction.slice(0, decimals)}`;
};

export const formatUSD = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
