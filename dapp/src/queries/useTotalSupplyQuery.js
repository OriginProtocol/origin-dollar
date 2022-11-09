import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { totalSupplyService } from '../services/total-supply.service'

const useTotalSupplyQuery = (options) => {
  return useQuery(
    QUERY_KEYS.TotalSupply(),
    () => totalSupplyService.fetchTotalSupply(),
    options
  )
}

export default useTotalSupplyQuery
