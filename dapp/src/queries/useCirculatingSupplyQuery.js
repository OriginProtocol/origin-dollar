import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { circulatingSupplyService } from '../services/circulating-supply.service'

const useCirculatingSupplyQuery = (options) => {
  return useQuery(
    QUERY_KEYS.CirculatingSupply(),
    () => circulatingSupplyService.fetchCirculatingSupply(),
    options
  )
}

export default useCirculatingSupplyQuery
