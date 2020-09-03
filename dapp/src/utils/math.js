export function formatCurrency(value, decimals) {
  if (value === '') {
    return '0.00'
  }

  const options = {
    minimumFractionDigits: decimals || 2,
    maximumFractionDigits: decimals || 5,
  }

  return parseFloat(value).toLocaleString('en', options)
}
