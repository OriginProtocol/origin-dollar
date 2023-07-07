import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { woethService } from '../services/woeth.service'

const useWOETHQuery = (account, contracts, options) => {
  return useQuery(
    QUERY_KEYS.WOETHValue(account),
    () => woethService.fetchWOETHValue(account, contracts),
    {
      enabled: account != null && contracts != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useWOETHQuery
