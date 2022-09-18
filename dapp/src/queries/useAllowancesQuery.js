import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { allowancesService } from '../services/allowances.service'

const useAllowancesQuery = (account, contracts, options) => {
  return useQuery(
    QUERY_KEYS.Allowances(account),
    () => allowancesService.fetchAllowances(account, contracts),
    {
      enabled: account != null && contracts != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useAllowancesQuery
