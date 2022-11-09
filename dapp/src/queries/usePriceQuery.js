import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { priceService } from '../services/price.service'

const usePriceQuery = (options) => {
  return useQuery(QUERY_KEYS.Price(), () => priceService.fetchPrice(), options)
}

export default usePriceQuery
