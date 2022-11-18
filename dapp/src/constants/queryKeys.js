export const QUERY_KEYS = {
  Allocation: () => ['allocation'],
  Allowances: (account) => ['allowances', { account }],
  Apy: () => ['apy'],
  ApyHistory: (days) => ['apyHistory', days],
  Balances: (account) => ['balances', { account }],
  CirculatingSupply: () => ['circulatingSupply'],
  Collateral: () => ['collateral'],
  Price: () => ['price'],
  TotalSupply: () => ['totalSupply'],
  TransactionHistory: (account) => ['transactionHistory', { account }],
  TransactionHistoryPage: (page, filters, account) => [
    'transactionHistoryPage',
    page,
    filters,
    { account },
  ],
  WousdValue: (account) => ['wousdValue', { account }],
}
