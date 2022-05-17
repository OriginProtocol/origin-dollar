import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryService } from '../services/transaction-history.service'

const useTransactionHistoryQuery = (account, pages, options) => {
  return useQuery(
    QUERY_KEYS.TransactionHistory(account),
    () => transactionHistoryService.fetchHistory(account, pages),
    {
      enabled: account != null && pages != 0,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryQuery
