export const QUERY_KEYS = {
  Allowances: (account) => ['allowances', { account }],
  Apy: () => ['apy'],
  Balances: (account) => ['balances', { account }],
  TransactionHistory: (account) => ['transactionHistory', { account }],
  TransactionHistoryPage: (page, filters, account) => [
    'transactionHistoryPage',
    page,
    filters,
    { account },
  ],
  WOETHValue: (account) => ['woethValue', { account }],
}
