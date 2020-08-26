export function formatCurrency(value) {
	const options = { 
	  minimumFractionDigits: 2,
	  maximumFractionDigits: 2 
	}

	return parseFloat(value).toLocaleString('en', options)
}