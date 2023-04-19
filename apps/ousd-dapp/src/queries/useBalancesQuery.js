import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { balancesService } from '../services/balances.service'

const useBalancesQuery = (account, contracts, options) => {
  return useQuery(
    QUERY_KEYS.Balances(account),
    () => balancesService.fetchBalances(account, contracts),
    {
      enabled: account != null && contracts != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useBalancesQuery
