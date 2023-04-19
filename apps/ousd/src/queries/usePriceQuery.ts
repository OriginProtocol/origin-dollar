import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { priceService } from '../services/price.service'

const usePriceQuery = (price, options) => {
  return useQuery(QUERY_KEYS.Price(), () => priceService.fetchPrice(), {
    initialData: price,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    ...options,
  })
}

export default usePriceQuery
