export const PEOPLE = [
  { name: "Matt", icon: "👨‍🚀" },
  { name: "Sofi", icon: "👸" },
  { name: "Raul", icon: "👨‍🎨" },
  { name: "Suparman", icon: "👨🏾‍🎤" },
  { name: "Anna", icon: "🧝🏻‍♀️" },
  { name: "Pyotr", icon: "👨🏻‍⚖️" },
];

export const CONTRACTS = [
  {
    name: "OUSD",
    icon: "🖲",
    isERC20: true,
    decimal: 18,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "OUSD" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "OUSD" },
        ],
      },
    ],
  },
  {
    name: "Vault",
    icon: "🏦",
    actions: [
      {
        name: "depositAndMint",
        params: [{ name: "Token", type: "erc20" }, { name: "Amount" }],
      },
      {
        name: "depositYield",
        params: [{ name: "Token", type: "erc20" }, { name: "Amount" }],
      },
    ],
  },
  {
    name: "USDT",
    icon: "💵",
    isERC20: true,
    decimal: 6,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "USDT" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "USDT" },
        ],
      },
      { name: "Mint", params: [{ name: "Amount", token: "USDT" }] },
    ],
    contractName: "MockUSDT",
  },
  {
    name: "DAI",
    icon: "📕",
    isERC20: true,
    decimal: 18,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "DAI" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "DAI" },
        ],
      },
      { name: "Mint", params: [{ name: "Amount", token: "DAI" }] },
    ],
    contractName: "MockDAI",
  },
  {
    name: "Oracle",
    icon: "🐔",
    decimal: 6,
    actions: [
      { name: "Price", params: [{ name: "Symbol" }] },
      {
        name: "SetPrice",
        params: [{ name: "Symbol" }, { name: "Price", token: "Oracle" }],
      },
    ],
    contractName: "MockOracle",
  },
];
