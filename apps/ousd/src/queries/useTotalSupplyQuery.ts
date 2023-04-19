import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { totalSupplyService } from '../services/total-supply.service'

const useTotalSupplyQuery = (total, options) => {
  return useQuery(
    QUERY_KEYS.TotalSupply(),
    () => totalSupplyService.fetchTotalSupply(),
    {
      initialData: total,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      ...options,
    }
  )
}

export default useTotalSupplyQuery
