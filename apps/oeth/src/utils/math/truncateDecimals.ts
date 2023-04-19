/**
 * Takes a number and truncates decimals values and
 * returns it as a string
 *
 * @param {String|Number} value Value to truncate
 * @param {Number} decimals Number of decimals to truncate to
 *
 * @returns {String} Truncated decimal value
 */
const truncateDecimals = (value, decimals = 6) => {
  if (!value) return value;
  const [whole, fraction] = value.toString().split('.');

  if (!fraction || fraction.length <= decimals) {
    // No change
    return value.toString();
  }

  // truncate decimals & return
  return `${whole}.${fraction.slice(0, decimals)}`;
};

export default truncateDecimals;
