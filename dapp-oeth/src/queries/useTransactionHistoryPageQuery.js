import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryPageService } from '../services/transaction-history-page.service'

const useTransactionHistoryPageQuery = (
  account,
  transactionHistoryItemsPerPage,
  page,
  filters,
  options
) => {
  return useQuery(
    QUERY_KEYS.TransactionHistoryPage(page, filters, account),
    () =>
      transactionHistoryPageService.fetchHistory(
        account,
        transactionHistoryItemsPerPage,
        page,
        filters
      ),
    {
      enabled: account != null,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      ...options,
    }
  )
}

export default useTransactionHistoryPageQuery
