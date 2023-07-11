import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryService } from '../services/transaction-history.service'

const useTransactionHistoryQuery = (token, account, filters, options) => {
  return useQuery(
    QUERY_KEYS.TransactionHistory(token, account),
    () => transactionHistoryService.fetchHistory(token, account, filters),
    {
      enabled: false,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryQuery
