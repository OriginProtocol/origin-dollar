export const PEOPLE = [
  { name: "Matt", icon: "👨‍🚀" },
  { name: "Governor", icon: "👨‍🎨" },
  { name: "Sofi", icon: "👸" },
  { name: "Suparman", icon: "👨🏾‍🎤" },
  { name: "Anna", icon: "🧝🏻‍♀️" },
  { name: "Attacker", icon: "👨🏻‍⚖️" },
];

export const CONTRACTS = [
  {
    name: "OUSD",
    addressName: "OUSDProxy",
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
    contractName: "VaultCore",
    addressName: "VaultProxy",
    icon: "🏦",
    actions: [
      {
        name: "Mint",
        params: [{ name: "Token", type: "erc20" }, { name: "Amount" }],
      },
      {
        name: "Redeem",
        params: [{ name: "Amount", token: "OUSD" }],
      },
      { name: "Rebase", params: [] },
      { name: "Allocate", params: [] },
    ],
  },
  {
    name: "VaultAdmin",
    addressName: "VaultProxy",
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
      { name: "setRedeemFeeBps", params: [{ name: "Basis Points" }] },
      { name: "SupportAsset", params: [{ name: "Token", type: "erc20" }] },
      { name: "SetVaultBuffer", params: [{ name: "Percent", decimals: 16 }] },
      {
        name: "transferToken",
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
    name: "OGN",
    icon: "💧",
    isERC20: true,
    decimal: 18,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "OGN" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "OGN" },
        ],
      },
      { name: "Mint", params: [{ name: "Amount", token: "OGN" }] },
    ],
    contractName: "MockOGN",
  },
  {
    name: "OUPAIR",
    icon: "⚖️",
    isERC20: true,
    decimal: 18,
    actions: [
      {
        name: "Transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "OUPAIR" },
        ],
      },
      {
        name: "Approve",
        params: [
          { name: "Allowed Spender", type: "address" },
          { name: "Amount", token: "OUPAIR" },
        ],
      },
      { name: "Mint", params: [{ name: "Amount", token: "OUPAIR" }] },
    ],
    contractName: "MockUniswapPairOUSD_USDT",
  },
  {
    name: "REWARD",
    icon: "💎",
    isERC20: true,
    decimal: 18,
    actions: [
      {
        name: "Deposit",
        params: [{ name: "Amount", token: "OUPAIR" }],
      },
      {
        name: "Exit",
        params: [],
      },
      { name: "Claim" },
      {
        name: "Withdraw",
        params: [{ name: "Amount", token: "OUPAIR" }, { name: "claim" }],
      },
      { name: "EmergencyWithdraw" },
      {
        name: "StartCampaign",
        params: [
          { name: "Reward per Block", token: "OUSD" },
          { name: "Start Block" },
          { name: "Num Blocks" },
        ],
      },
      {
        name: "StopCampaign",
      },
    ],
    contractName: "LiquidityReward",
    addressName: "LiquidityRewardOUSD_USDTProxy",
  },
  {
    name: "CompensationClaims",
    icon: "🎴",
    contractName: "CompensationClaims",
    actions: [
      { name: "LockAdjuster" },
      { name: "UnlockAdjuster" },
      { name: "Start", params: { name:"Seconds"} },
      { name: "Collect"},
      {
        name: "Claim",
        params: [
          { name: "Account", type: "address" },
        ],
      },
    ],
  },
  {
    name: "GenericContract",
    icon: "🏬",
    contractName: "MockNonRebasing",
    actions: [
      { name: "rebaseOptIn" },
      { name: "rebaseOptOut" },
      {
        name: "transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "OUSD" },
        ],
      },
    ],
  },
  {
    name: "ACMECollective",
    icon: "🏭",
    contractName: "MockNonRebasingTwo",
    actions: [
      { name: "rebaseOptIn" },
      { name: "rebaseOptOut" },
      {
        name: "transfer",
        params: [
          { name: "To", type: "address" },
          { name: "Amount", token: "OUSD" },
        ],
      },
    ],
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
  {
    name: "CompStrat",
    icon: "S",
    contractName: "CompoundStrategy",
    actions: [],
  },
  {
    name: "ChOracleDAI",
    icon: "⛓",
    contractName: "MockChainlinkOracleFeedDAI",
    actions: [
      {
        name: "setPrice",
        params: [{ name: "Price", decimals: 16 }],
      },
    ],
  },
  {
    name: "ChOracleUSDC",
    icon: "⛓",
    contractName: "MockChainlinkOracleFeedUSDC",
    actions: [
      {
        name: "setPrice",
        params: [{ name: "Price", decimals: 16 }],
      },
    ],
  },
  {
    name: "ChOracleUSDT",
    icon: "⛓",
    contractName: "MockChainlinkOracleFeedUSDT",
    actions: [
      {
        name: "setPrice",
        params: [{ name: "Price", decimals: 16 }],
      },
    ],
  },
];

export const SETUP = `
  Governor VaultAdmin unpauseDeposits
  Governor VaultAdmin setRedeemFeeBps 50
  Matt DAI mint 250000DAI
  Matt USDC mint 300000USDC
  Matt USDT mint 400000USDC
  Matt DAI approve Vault 9999999999DAI
  Matt USDC approve Vault 9999999999USDC
  Matt USDT approve Vault 9999999999USDT
  Matt Vault mint DAI 150000DAI
  Matt Vault mint USDC 200000USDT
  Matt Vault mint USDT 300000USDT
  Sofi USDC mint 12000USDC
  Sofi USDC approve Vault 9999999999USDC
  Sofi Vault mint USDC 10000USDC
  Suparman USDC mint 1000USDC
  Anna USDC mint 1000USDC
  Attacker USDT mint 10000000USDT
  Attacker USDT approve Vault 9999999USDT
  Governor GenericContract setOUSD OUSD
  Governor ACMECollective setOUSD OUSD
`;

export const SCENARIOS = [
  {
    name: "Add Yield",
    actions: `
    # Fake adding yield for OUSD by directly
    # depositing money to the vault, then rebasing.
    Anna USDC mint 5000USDC
    Anna USDC transfer Vault 5000USDC
    Governor Vault rebase
    `,
  },
  {
    name: "Spread Oracles",
    actions: `
      # Sets oracle prices to various values, to allow easy
      # playing with the DAPP.

      Governor ORACLE setPrice "DAI" 1.0305ORACLE
      Governor ChOracleDAI setPrice 10250000000000000

      Governor ORACLE setPrice "USDC" 1.010ORACLE
      Governor ChOracleUSDC setPrice 10050000000000000
      
      Governor ORACLE setPrice "USDT" 0.98ORACLE
      Governor ChOracleUSDT setPrice 9745000000000000
      
      Governor Vault rebase
    `,
  },
  {
    name: "💎 Join LP Rewards",
    actions: `
      Sofi OUPAIR mint 3000OUPAIR
      Sofi OUPAIR approve REWARD 99999999999OUPAIR
      Sofi REWARD deposit 2500OUPAIR
      Sofi REWARD withdraw 2500OUPAIR 1
    `,
  },
  {
    name: "💎 All Withdraw After Campaign",
    actions: `
      # Users are going to mint in before the campaign starts,
      Governor REWARD StopCampaign
      Sofi OUPAIR mint 3000OUPAIR
      Sofi OUPAIR approve REWARD 99999999999OUPAIR
      Sofi REWARD deposit 2500OUPAIR
      Anna OUPAIR mint 3000OUPAIR
      Anna OUPAIR approve REWARD 99999999999OUPAIR
      Anna REWARD deposit 2500OUPAIR

      # Start campain, and run until over
      Governor REWARD StartCampaign 100OGN 145 10
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      Suparman USDC transfer Matt 1USDC
      
      # Both Exit
      Sofi REWARD exit
      Anna REWARD withdraw 2500REWARD 1
    `,
  },
  {
    name: "Use compound strategy",
    actions: `
    Governor VaultAdmin removeStrategy CompStrat
    Matt USDC mint 300000USDC
    Matt USDC approve Vault 9999999999USDC
    Matt Vault mint USDC 300000USDC
    Governor VaultAdmin addStrategy CompStrat 1000000000000000000
    Governor Vault allocate
    `,
  },
  {
    name: "🥊: Cheap coin mint and redeem",
    actions: `
    # Attacker does not net benefit
    Governor ORACLE setPrice "USDT" 0.80ORACLE
    Governor ChOracleUSDT setPrice 8000000000000000
    Attacker Vault mint USDT 300000USDT
    Attacker Vault rebase
    Attacker Vault redeem 256000OUSD
    `,
  },
  {
    name: "🥊: Expensive coin mint and redeem",
    actions: `
    # Attacker does not net benefit
    Governor ORACLE setPrice "USDT" 1.20ORACLE
    Governor ChOracleUSDT setPrice 12000000000000000
    Attacker Vault mint USDT 300000USDT
    Attacker Vault rebase
    Attacker Vault redeem 256000OUSD
    `,
  },
  {
    name: "🥊: Stattacto",
    actions: `
    # Attacker does not net benefit
    Governor VaultAdmin setRedeemFeeBps 500
    Governor ORACLE setPrice "USDT" 0.80ORACLE
    Governor ChOracleUSDT setPrice 8000000000000000
    Matt Vault mint USDT 100000USDT
    Attacker Vault mint USDT 999USDT
    Attacker Vault mint USDT 999USDT
    Attacker Vault mint USDT 999USDT
    Attacker Vault mint USDT 999USDT
    Attacker Vault mint USDT 999USDT
    Attacker Vault rebase
    Attacker Vault redeem 800OUSD
    Attacker Vault redeem 800OUSD
    Attacker Vault redeem 800OUSD
    Attacker Vault redeem 800OUSD
    Attacker Vault redeem 800OUSD
    
    `,
  },
  {
    name: "🥊: Flash loan, coin exchange",
    actions: `
    # Attacker does not net benefit
    Governor VaultAdmin setRedeemFeeBps 50
    Governor ORACLE setPrice "USDT" 0.80ORACLE
    Governor ORACLE setPrice "USDT" 0.80ORACLE
    Attacker Vault mint USDT 5000000USDT
    Matt OUSD transfer Attacker 300000OUSD
    Attacker USDT transfer Matt 375000USDT
    Attacker Vault rebase
    Attacker Vault redeem 5297679OUSD
    `,
  },
  {
    name: "Mint OUSD",
    actions: `
    # Sofi mints 50 USD
    Sofi USDC approve Vault 50USDC  
    Sofi Vault mint USDC 50USDC
    `,
  },
  {
    name: "Redeem OUSD",
    actions: `
    Sofi Vault redeem 50OUSD
    `,
  },
  {
    name: "Rebase Contract Opt-In",
    actions: `
    Sofi OUSD transfer GenericContract 1000.97OUSD
    Matt DAI transfer Vault 2000DAI
    Governor Vault rebase
    Governor GenericContract rebaseOptIn
`,
  },
];
