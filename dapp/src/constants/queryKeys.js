export const QUERY_KEYS = {
  TransactionHistory: (account) => ['transactionHistory', { account }],
  TransactionHistoryWrapped: (account) => ['transactionHistoryWrapped', { account }],
  Balances: (account) => ['balances', { account }],
  Allowances: (account) => ['allowances', { account }],
  Apy: () => ['apy'],
  WousdValue: (account) => ['wousdValue', { account }],
}
