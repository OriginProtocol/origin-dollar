import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryPageService } from '../services/transaction-history-page.service'

const useTransactionHistoryPageQuery = (
  account,
  transactionHistoryItemsPerPage,
  options
) => {
  return useQuery(
    QUERY_KEYS.TransactionHistoryPage(account),
    () =>
      transactionHistoryPageService.fetchHistory(
        account,
        transactionHistoryItemsPerPage
      ),
    {
      enabled: account != null,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryPageQuery
