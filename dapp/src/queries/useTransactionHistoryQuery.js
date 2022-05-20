import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryService } from '../services/transaction-history.service'

const useTransactionHistoryQuery = (account, filters, options) => {
  return useQuery(
    QUERY_KEYS.TransactionHistory(account),
    () => transactionHistoryService.fetchHistory(account, filters),
    {
      enabled: false,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryQuery
