const { task, types } = require("hardhat/config");

const { fund, mint, redeem, redeemFor, transfer } = require("./account");
const { debug } = require("./debug");
const { env } = require("./env");
const { execute, executeOnFork, proposal, governors } = require("./governance");
const { balance } = require("./ousd");
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
const { allocate, capital, harvest, rebase, yield } = require("./vault");
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
task("mint", "Mint OUSD on local or fork")
  .addOptionalParam("num", "Number of accounts to mint for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of OUSD to mint")
  .setAction(mint);
task("redeem", "Redeem OUSD on local or fork")
  .addOptionalParam("num", "Number of accounts to redeem for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of OUSD to redeem")
  .setAction(redeem);
task("redeemFor", "Redeem OUSD on local or fork")
  .addOptionalParam("account", "Account that calls the redeem")
  .addOptionalParam("amount", "Amount of OUSD to redeem")
  .setAction(redeemFor);
task("transfer", "Transfer OUSD")
  .addParam("index", "Account  index")
  .addParam("amount", "Amount of OUSD to transfer")
  .addParam("to", "Destination address")
  .setAction(transfer);

// Debug tasks.
task("debug", "Print info about contracts and their configs", debug);

// OUSD tasks.
task("balance", "Get OUSD balance of an account")
  .addParam("account", "The account's address")
  .setAction(balance);

// Vault tasks.
task("allocate", "Call allocate() on the Vault", allocate);
task("capital", "Set the Vault's pauseCapital flag", capital);
task("harvest", "Call harvest() on Vault", harvest);
task("rebase", "Call rebase() on the Vault", rebase);
task("yield", "Artificially generate yield on the Vault", yield);

// Governance tasks
task("execute", "Execute a governance proposal")
  .addParam("id", "Proposal ID")
  .addOptionalParam("governor", "Override Governor address")
  .setAction(execute);
task("executeOnFork", "Enqueue and execute a proposal on the Fork")
  .addParam("id", "Id of the proposal")
  .addOptionalParam("gaslimit", "Execute proposal gas limit")
  .setAction(executeOnFork);
task("proposal", "Dumps the state of a proposal")
  .addParam("id", "Id of the proposal")
  .setAction(proposal);
task("governors", "Get list of governors for all contracts").setAction(
  governors
);

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
task("curvePool", "Dumps the current state of a Curve pool")
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

// Curve Pools
task("amoStrat", "Dumps the current state of a AMO strategy")
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

task("curveAdd", "Add liquidity to Curve Metapool")
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

task("curveRemove", "Remove liquidity from Curve Metapool")
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

task("curveSwap", "Swap Metapool tokens")
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
