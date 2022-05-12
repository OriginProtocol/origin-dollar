import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryWrappedService } from '../services/transaction-history-wrapped.service'

const useTransactionHistoryWrappedQuery = (account, options) => {
  return useQuery(
    QUERY_KEYS.TransactionHistoryWrapped(account),
    () => transactionHistoryWrappedService.fetchHistoryWrapped(account),
    {
      enabled: account != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryWrappedQuery
