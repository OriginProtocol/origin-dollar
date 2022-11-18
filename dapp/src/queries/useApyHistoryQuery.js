import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { apyHistoryService } from '../services/apy-history.service'

const useApyHistoryQuery = (apyHistory, options) => {
  return useQuery(
    QUERY_KEYS.ApyHistory(),
    () => apyHistoryService.fetchApyHistory(),
    {
      initialData: apyHistory,
      keepPreviousData: true,
      ...options,
    }
  )
}

export default useApyHistoryQuery
