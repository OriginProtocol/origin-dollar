import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { apyService } from '../services/apy.service'

const useApyQuery = (options) => {
  return useQuery(QUERY_KEYS.Apy(), () => apyService.fetchApy(), options)
}

export default useApyQuery
