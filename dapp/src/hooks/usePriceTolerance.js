import React, { useState, useEffect } from 'react'

const usePriceTolerance = (mode) => {
  const [priceToleranceValue, setPriceTolerFct] = useState(null)
  const priceToleranceLocalStorageKey = `selected_price_tolerance_${mode}`

  // store price tolerance value for future default setting
  useEffect(() => {
    // default price tolerance value
    let priceTolerance = 0.5
    let localStorageValue = localStorage.getItem(priceToleranceLocalStorageKey)
    if (localStorageValue) {
      const localStorageParsed = parseFloat(localStorageValue)
      if (
        localStorageParsed !== null &&
        localStorageParsed !== undefined &&
        !Number.isNaN(localStorageParsed)
      ) {
        priceTolerance = localStorageParsed
      }
    }
    setPriceToleranceValue(priceTolerance)
  }, [])

  const setPriceToleranceValue = (value) => {
    setPriceTolerFct(value)
    localStorage.setItem(priceToleranceLocalStorageKey, value)
  }

  return {
    setPriceToleranceValue,
    priceToleranceValue,
    //dropdownToleranceOptions,
  }
}

export default usePriceTolerance
