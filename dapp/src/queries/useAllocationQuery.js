import { useQuery } from 'react-query'

import { QUERY_KEYS } from 'constants/queryKeys'

import { allocationService } from '../services/allocation.service'

const useAllocationQuery = (options) => {
  return useQuery(
    QUERY_KEYS.Allocation(),
    () => allocationService.fetchAllocation(),
    options
  )
}

export default useAllocationQuery
