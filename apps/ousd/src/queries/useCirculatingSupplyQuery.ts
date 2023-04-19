import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { circulatingSupplyService } from '../services/circulating-supply.service'

const useCirculatingSupplyQuery = (circulating, options) => {
  return useQuery(
    QUERY_KEYS.CirculatingSupply(),
    () => circulatingSupplyService.fetchCirculatingSupply(),
    {
      initialData: circulating,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      ...options,
    }
  )
}

export default useCirculatingSupplyQuery
