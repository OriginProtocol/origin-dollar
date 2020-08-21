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
    name: "USDC",
    icon: "💵",
    isERC20: true,
    decimal: 6,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "USDC" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "USDC" },
        ],
      },
      { name: "Mint", params: [{ name: "Amount", token: "USDC" }] },
    ],
    contractName: "MockUSDC",
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
    name: "ORACLE",
    icon: "🐔",
    decimal: 6,
    actions: [
      {
        name: "SetPrice",
        params: [{ name: "Symbol" }, { name: "Price", token: "ORACLE" }],
      },
    ],
    contractName: "MockOracle",
  },
  {
    name: "CompoundDIA",
    icon: "D",
    contractName: "MockCDAI",
    actions: [],
  },
  {
    name: "CompoundUSDC",
    icon: "C",
    contractName: "MockCUSDC",
    actions: [],
  },
  {
    name: "COMP",
    icon: "*",
    contractName: "MockCOMP",
    isERC20: true,
    actions: [],
  },
];
