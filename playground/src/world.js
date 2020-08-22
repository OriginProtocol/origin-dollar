export const PEOPLE = [
  { name: "Matt", icon: "👨‍🚀" },
  { name: "Sofi", icon: "👸" },
  { name: "Governer", icon: "👨‍🎨" },
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
        name: "Mint",
        params: [{ name: "Token", type: "erc20" }, { name: "Amount" }],
      },
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
        name: "PauseDeposits",
        params: [],
      },
      {
        name: "UnpauseDeposits",
        params: [],
      },
      { name: "Rebase", params: [] },
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

export const SETUP = `
  Governer Vault unpauseDeposits
  Matt USDC mint 3000USDC
  Matt DAI mint 390000DAI
  Matt USDC approve OUSD 9999999999USDC
  Matt DAI approve OUSD 9999999999DAI
  Matt OUSD mint DAI 1000DAI
  Sofi USDC mint 2000USDC
  Sofi USDC approve OUSD 9999999999USDC
  Sofi OUSD mint USDC 1000USDC
  Suparman USDC mint 1000USDC
  Anna USDC mint 1000USDC
  Pyotr USDC mint 3000USDC
  Pyotr USDC approve OUSD 9999999USDC
`;

export const SCENARIOS = [
  {
    name: "Oracle lag attack, single asset",
    actions: `
      # If an oracle lags on going down, an attacker can purchase
      # an asset from the real world, put it into the contract,
      # exchanging it for OUSD at a discounted rate.
      # When the oracle is finaly up to date, the attacker 
      # can then withdraw more funds than they put in.
      Governer ORACLE setPrice "USDC" 2.00ORACLE
      Governer Vault rebase
      # At this point the real price of the asset changes
      # but the oracle is not yet updated.
      Pyotr OUSD mint USDC 2000USDC
      # Eventualy the price is updated to the true price
      Governer ORACLE setPrice "USDC" 1.00ORACLE
      Governer Vault rebase
      # And Pyotr has more assets than he did before
    `,
  },
];
