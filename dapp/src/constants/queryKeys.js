export const QUERY_KEYS = {
  TransactionHistoryPage: (page, filters, account) => ['transactionHistoryPage', page, filters, { account }],
  TransactionHistory: (account) => ['transactionHistory', { account }],
  Balances: (account) => ['balances', { account }],
  Allowances: (account) => ['allowances', { account }],
  Apy: () => ['apy'],
  WousdValue: (account) => ['wousdValue', { account }],
}
