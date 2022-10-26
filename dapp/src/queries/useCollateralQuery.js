import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { collateralService } from '../services/collateral.service'

const useCollateralQuery = (options) => {
  return useQuery(
    QUERY_KEYS.Collateral(),
    () => collateralService.fetchCollateral(),
    options
  )
}

export default useCollateralQuery
