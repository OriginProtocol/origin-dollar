const { subtask, task, types } = require("hardhat/config");

const { fund } = require("./account");
const { debug } = require("./debug");
const { env } = require("./env");
const { execute, executeOnFork, proposal, governors } = require("./governance");
const { smokeTest, smokeTestCheck } = require("./smokeTest");
const {
  storeStorageLayoutForAllContracts,
  assertStorageLayoutChangeSafe,
  assertStorageLayoutChangeSafeForAll,
  showStorageLayout,
} = require("./storageSlots");
const {
  isAdjusterLocked,
  fundCompAccountsWithEth,
  claimOGN,
  claimOUSD,
  checkOUSDBalances,
  supplyStakingContractWithOGN,
} = require("./compensation");
const {
  tokenAllowance,
  tokenBalance,
  tokenApprove,
  tokenTransfer,
  tokenTransferFrom,
} = require("./tokens");
const {
  allocate,
  capital,
  depositToStrategy,
  mint,
  rebase,
  redeem,
  redeemAll,
  withdrawFromStrategy,
  withdrawAllFromStrategy,
  withdrawAllFromStrategies,
  yieldTask,
} = require("./vault");
const { checkDelta, getDelta, takeSnapshot } = require("./valueChecker");
const {
  amoStrategyTask,
  curveAddTask,
  curveRemoveTask,
  curveSwapTask,
  curvePoolTask,
} = require("./curve");

// Environment tasks.
task("env", "Check env vars are properly set for a Mainnet deployment", env);

// Account tasks.
task("fund", "Fund accounts on local or fork")
  .addOptionalParam("num", "Number of accounts to fund")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Stable coin amount to fund each account with")
  .addOptionalParam(
    "accountsfromenv",
    "Fund accounts from the .env file instead of mnemonic"
  )
  .setAction(fund);

// Debug tasks.
task("debug", "Print info about contracts and their configs", debug);

// Token tasks.
subtask("allowance", "Get the token allowance an owner has given to a spender")
  .addParam(
    "symbol",
    "Symbol of the token. eg OETH, WETH, USDT or OGV",
    undefined,
    types.string
  )
  .addParam(
    "spender",
    "The address of the account or contract that can spend the tokens"
  )
  .addOptionalParam(
    "owner",
    "The address of the account or contract allowing the spending. Default to the signer"
  )
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(tokenAllowance);
task("allowance").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("balance", "Get the token balance of an account or contract")
  .addParam(
    "symbol",
    "Symbol of the token. eg OETH, WETH, USDT or OGV",
    undefined,
    types.string
  )
  .addOptionalParam(
    "account",
    "The address of the account or contract. Default to the signer"
  )
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(tokenBalance);
task("balance").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("approve", "Approve an account or contract to spend tokens")
  .addParam(
    "symbol",
    "Symbol of the token. eg OETH, WETH, USDT or OGV",
    undefined,
    types.string
  )
  .addParam(
    "amount",
    "Amount of tokens that can be spent",
    undefined,
    types.float
  )
  .addParam(
    "spender",
    "Address of the account or contract that can spend the tokens",
    undefined,
    types.string
  )
  .setAction(tokenApprove);
task("approve").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("transfer", "Transfer tokens to an account or contract")
  .addParam(
    "symbol",
    "Symbol of the token. eg OETH, WETH, USDT or OGV",
    undefined,
    types.string
  )
  .addParam("amount", "Amount of tokens to transfer", undefined, types.float)
  .addParam("to", "Destination address", undefined, types.string)
  .setAction(tokenTransfer);
task("transfer").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("transferFrom", "Transfer tokens from an account or contract")
  .addParam(
    "symbol",
    "Symbol of the token. eg OETH, WETH, USDT or OGV",
    undefined,
    types.string
  )
  .addParam("amount", "Amount of tokens to transfer", undefined, types.float)
  .addParam("from", "Source address", undefined, types.string)
  .addOptionalParam(
    "to",
    "Destination address. Default to signer",
    undefined,
    types.string
  )
  .setAction(tokenTransferFrom);
task("transferFrom").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Vault tasks.
task("allocate", "Call allocate() on the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(allocate);
task("allocate").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("capital", "Set the Vault's pauseCapital flag")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "pause",
    "Whether to pause or unpause the capital allocation",
    "true",
    types.boolean
  )
  .setAction(capital);
task("capital").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("rebase", "Call rebase() on the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(rebase);
task("rebase").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("yield", "Artificially generate yield on the OUSD Vault", yieldTask);

subtask("mint", "Mint OTokens from the Vault using collateral assets")
  .addParam(
    "asset",
    "Symbol of the collateral asset to deposit. eg WETH, frxETH, USDT, DAI",
    undefined,
    types.string
  )
  .addParam(
    "amount",
    "Amount of collateral assets to deposit",
    undefined,
    types.float
  )
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addOptionalParam("min", "Minimum amount of OTokens to mint", 0, types.float)
  .setAction(mint);
task("mint").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("redeem", "Redeem OTokens for collateral assets from the Vault")
  .addParam("amount", "Amount of OTokens to burn", undefined, types.float)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addOptionalParam(
    "min",
    "Minimum amount of collateral to receive",
    0,
    types.float
  )
  .setAction(redeem);
task("redeem").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("redeemAll", "Redeem all OTokens for collateral assets from the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addOptionalParam(
    "min",
    "Minimum amount of collateral to receive",
    0,
    types.float
  )
  .setAction(redeemAll);
task("redeemAll").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "depositToStrategy",
  "Deposits vault collateral assets to a vault strategy"
)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "strategy",
    "Address or contract name of the strategy",
    undefined,
    types.string
  )
  .addParam(
    "assets",
    "Comma separated list of token symbols with no spaces. eg DAI,USDT,USDC or WETH",
    undefined,
    types.string
  )
  .addParam(
    "amounts",
    "Comma separated list of token amounts with no spaces. eg 1000.123456789,2000.89,5000.123456 or 23.987",
    undefined,
    types.string
  )
  .setAction(depositToStrategy);
task("depositToStrategy").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("withdrawFromStrategy", "Withdraw assets from a vault strategy")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "strategy",
    "Address or contract name of the strategy",
    undefined,
    types.string
  )
  .addParam(
    "assets",
    "Comma separated list of token symbols with no spaces. eg DAI,USDT,USDC or WETH",
    undefined,
    types.string
  )
  .addParam(
    "amounts",
    "Comma separated list of token amounts with no spaces. eg 1000.123456789,2000.89,5000.123456 or 23.987",
    undefined,
    types.string
  )
  .setAction(withdrawFromStrategy);
task("withdrawFromStrategy").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("withdrawAllFromStrategy", "Withdraw all assets from a vault strategy")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "strategy",
    "Address or contract name of the strategy",
    undefined,
    types.string
  )
  .setAction(withdrawAllFromStrategy);
task("withdrawAllFromStrategy").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "withdrawAllFromStrategies",
  "Withdraw all assets from all of a vault's strategies"
)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(withdrawAllFromStrategies);
task("withdrawAllFromStrategies").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Governance tasks
subtask("execute", "Execute a governance proposal")
  .addParam("id", "Proposal ID")
  .addOptionalParam("governor", "Override Governor address")
  .setAction(execute);
task("execute").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("executeOnFork", "Enqueue and execute a proposal on the Fork")
  .addParam("id", "Id of the proposal")
  .addOptionalParam("gaslimit", "Execute proposal gas limit")
  .setAction(executeOnFork);
task("executeOnFork").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("proposal", "Dumps the state of a proposal")
  .addParam("id", "Id of the proposal")
  .setAction(proposal);
task("proposal").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("governors", "Get list of governors for all contracts").setAction(
  governors
);
task("governors").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Compensation tasks
task("isAdjusterLocked", "Is adjuster on Compensation claims locked").setAction(
  isAdjusterLocked
);
task(
  "fundCompAccountsWithEth",
  "Fund compensation accounts with minimal eth"
).setAction(fundCompAccountsWithEth);
task(
  "claimOUSD",
  "Claim the OUSD part of the compensation plan for all eligible users"
).setAction(claimOUSD);
task(
  "checkOUSDBalances",
  "Check ousd balances of contract and accounts"
).setAction(checkOUSDBalances);
task(
  "supplyStakingWithOGN",
  "Supplies a great amount of ogn to staking contract"
).setAction(supplyStakingContractWithOGN);
task(
  "claimOGN",
  "Claims the OGN part of the compensation plan for all eligible users"
).setAction(claimOGN);

// Smoke tests
task(
  "smokeTest",
  "Execute smoke test before and after parts when applying the deployment script on the mainnet:fork network"
)
  .addOptionalParam(
    "deployid",
    "Optional deployment id to run smoke tests against"
  )
  .setAction(smokeTest);
task(
  "smokeTestCheck",
  "Execute necessary smoke test environment / deploy script checks before the node is initialized"
)
  .addOptionalParam(
    "deployid",
    "Optional deployment id to run smoke tests against"
  )
  .setAction(smokeTestCheck);

// Storage slots
task(
  "saveStorageSlotLayout",
  "Saves storage slot layout of all the current contracts in the code base to repo. Contract changes can use this file for future reference of storage layout for deployed contracts."
).setAction(storeStorageLayoutForAllContracts);

task(
  "checkUpgradability",
  "Checks storage slots of a contract to see if it is safe to upgrade it."
)
  .addParam("name", "Name of the contract.")
  .setAction(assertStorageLayoutChangeSafe);

task(
  "checkUpgradabilityAll",
  "Checks storage slot upgradability for all contracts"
).setAction(assertStorageLayoutChangeSafeForAll);

task("showStorageLayout", "Visually show the storage layout of the contract")
  .addParam("name", "Name of the contract.")
  .setAction(showStorageLayout);

// Curve Pools
subtask("curvePool", "Dumps the current state of a Curve pool")
  .addParam("pool", "Symbol of the curve Metapool. OUSD or OETH")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "fromBlock",
    "Block number to compare back to. (default: no diff)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "user",
    "Address of user adding, removing or swapping tokens. (default: no user)",
    undefined,
    types.string
  )
  .setAction(curvePoolTask);
task("curvePool").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Curve Pools
subtask("amoStrat", "Dumps the current state of a AMO strategy")
  .addParam("pool", "Symbol of the curve Metapool. OUSD or OETH")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "fromBlock",
    "Block number to compare back to. (default: no diff)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "user",
    "Address of user adding, removing or swapping tokens. (default: no user)",
    undefined,
    types.string
  )
  .setAction(amoStrategyTask);
task("amoStrat").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("curveAdd", "Add liquidity to Curve Metapool")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam("otokens", "Amount of OTokens. eg OETH or OUSD", 0, types.float)
  .addParam("assets", "Amount of assets. eg ETH or 3CRV", 0, types.float)
  .addOptionalParam(
    "slippage",
    "Max allowed slippage as a percentage to 2 decimal places.",
    1.0,
    types.float
  )
  .addOptionalParam(
    "min",
    "Min Metapool LP tokens to be minted.",
    undefined,
    types.float
  )
  .setAction(curveAddTask);
task("curveAdd").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("curveRemove", "Remove liquidity from Curve Metapool")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam("otokens", "Amount of OTokens. eg OETH or OUSD", 0, types.float)
  .addParam("assets", "Amount of assets. eg ETH or 3CRV", 0, types.float)
  .addOptionalParam(
    "slippage",
    "Max allowed slippage as a percentage to 2 decimal places.",
    1.0,
    types.float
  )
  .setAction(curveRemoveTask);
task("curveRemove").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("curveSwap", "Swap Metapool tokens")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "from",
    "Symbol of the from token. eg OETH, ETH, 3CRV, OUSD",
    undefined,
    types.string
  )
  .addParam("amount", "Amount of from tokens.", 0, types.float)
  .addOptionalParam("min", "Min tokens out.", 0, types.float)
  .setAction(curveSwapTask);
task("curveSwap").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Vault Value Checker
subtask("vaultDelta", "Get a vaults's delta values")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(getDelta);
task("vaultDelta").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("takeSnapshot", "Takes a snapshot of a vault's values")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(takeSnapshot);
task("takeSnapshot").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("checkDelta", "Checks a vault's delta values")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam("profit", "Expected profit", undefined, types.float)
  .addParam("profitVariance", "Allowed profit variance", undefined, types.float)
  .addParam(
    "vaultChange",
    "Expected change in total supply ",
    undefined,
    types.float
  )
  .addParam(
    "vaultChangeVariance",
    "Allowed total supply variance",
    undefined,
    types.float
  )
  .setAction(checkDelta);
task("checkDelta").setAction(async (_, __, runSuper) => {
  return runSuper();
});
