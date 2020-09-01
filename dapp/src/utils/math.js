export function formatCurrency(value, decimals = 2) {
  if (value === '') {
    return '0'
  }

  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }

  return parseFloat(value).toLocaleString('en', options)
}
