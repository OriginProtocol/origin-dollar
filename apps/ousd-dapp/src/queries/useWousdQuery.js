import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { wousdService } from '../services/wousd.service'

const useWousdQuery = (account, contracts, options) => {
  return useQuery(
    QUERY_KEYS.WousdValue(account),
    () => wousdService.fetchWousdValue(account, contracts),
    {
      enabled: account != null && contracts != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useWousdQuery
