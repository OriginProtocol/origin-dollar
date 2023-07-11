export const QUERY_KEYS = {
  Allowances: (account) => ['allowances', { account }],
  Apy: () => ['apy'],
  Balances: (account) => ['balances', { account }],
  TransactionHistory: (account) => ['transactionHistory', { account }],
  TransactionHistoryPage: (token, page, filters, account) => [
    'transactionHistoryPage',
    token,
    page,
    filters,
    { account },
  ],
  WousdValue: (account) => ['wousdValue', { account }],
}
