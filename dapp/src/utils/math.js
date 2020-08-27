export function formatCurrency(value, decimals = 2) {
  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }

  return parseFloat(value).toLocaleString('en', options)
}
