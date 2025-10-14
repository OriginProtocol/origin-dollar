const { subtask, task, types } = require("hardhat/config");
const { fund } = require("./account");
const { debug } = require("./debug");
const { env } = require("./env");
const { setActionVars } = require("./defender");
const { execute, executeOnFork, proposal, governors } = require("./governance");
const { smokeTest, smokeTestCheck } = require("./smokeTest");
const addresses = require("../utils/addresses");
const { getNetworkName } = require("../utils/hardhat-helpers");
const {
  genECDHKey,
  decryptValidatorKey,
  decryptValidatorKeyWithMasterKey,
  signMessage,
} = require("./crypto");
const { advanceBlocks } = require("./block");
const {
  encryptMasterPrivateKey,
  decryptMasterPrivateKey,
} = require("./amazon");
const { collect, setDripDuration } = require("./dripper");
const { getSigner } = require("../utils/signers");
const { snapAero } = require("./aero");
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
const { depositWETH, withdrawWETH } = require("./weth");
const {
  addWithdrawalQueueLiquidity,
  allocate,
  capital,
  depositToStrategy,
  mint,
  rebase,
  redeem,
  requestWithdrawal,
  claimWithdrawal,
  snapVault,
  withdrawFromStrategy,
  withdrawAllFromStrategy,
  withdrawAllFromStrategies,
  yieldTask,
} = require("./vault");
const { checkDelta, getDelta, takeSnapshot } = require("./valueChecker");
const {
  curveAddTask,
  curveRemoveTask,
  curveSwapTask,
  curvePoolTask,
} = require("./curve");
const {
  depositSSV,
  withdrawSSV,
  printClusterInfo,
  removeValidators,
} = require("./ssv");
const {
  amoStrategyTask,
  mintAndAddOTokensTask,
  removeAndBurnOTokensTask,
  removeOnlyAssetsTask,
} = require("./amoStrategy");
const { proxyUpgrades } = require("./proxy");
const {
  governor,
  transferGovernance,
  claimGovernance,
} = require("./governable");
const {
  getRewardTokenAddresses,
  setRewardTokenAddresses,
  checkBalance,
  transferToken,
} = require("./strategy");
const {
  validatorOperationsConfig,
  exitValidators,
  doAccounting,
  manuallyFixAccounting,
  resetStakeETHTally,
  setStakeETHThreshold,
  fixAccounting,
  pauseStaking,
  snapStaking,
  resolveNativeStakingStrategyProxy,
  snapValidators,
} = require("./validator");
const {
  snapStakingStrategy,
  snapBalances,
  registerValidatorCreateRequest,
  registerValidator,
  stakeValidator,
  withdrawValidator,
  removeValidator,
  autoValidatorWithdrawals,
  setRegistrator,
} = require("./validatorCompound");
const { tenderlySync, tenderlyUpload } = require("./tenderly");
const { setDefaultValidator, snapSonicStaking } = require("../utils/sonic");
const {
  undelegateValidator,
  withdrawFromSFC,
} = require("../utils/sonicActions");
const { registerValidators, stakeValidators } = require("../utils/validator");
const { harvestAndSwap } = require("./harvest");
const { deployForceEtherSender, forceSend } = require("./simulation");
const { lzBridgeToken, lzSetConfig } = require("./layerzero");
const {
  requestValidatorWithdraw,
  beaconRoot,
  getValidator,
  verifyValidator,
  verifyDeposit,
  verifyBalances,
} = require("./beacon");
const {
  calcDepositRoot,
  depositValidator,
  mockBeaconRoot,
  copyBeaconRoot,
} = require("./beaconTesting");

const log = require("../utils/logger")("tasks");

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

// WETH tasks
subtask("depositWETH", "Deposit ETH into WETH")
  .addParam("amount", "Amount of ETH to deposit", undefined, types.float)
  .setAction(async (taskArgs) => {
    const signer = await getSigner();

    const networkName = await getNetworkName();
    const symbol = networkName == "sonic" ? "wS" : "WETH";
    const wethAddress = addresses[networkName][symbol];
    const weth = await ethers.getContractAt("IWETH9", wethAddress);

    await depositWETH({ ...taskArgs, weth, signer });
  });
task("depositWETH").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("withdrawWETH", "Withdraw ETH from WETH")
  .addParam("amount", "Amount of ETH to withdraw", undefined, types.float)
  .setAction(async (taskArgs) => {
    const signer = await getSigner();

    const networkName = await getNetworkName();
    const wethAddress = addresses[networkName].WETH;
    const weth = await ethers.getContractAt("IWETH9", wethAddress);

    await withdrawWETH({ ...taskArgs, weth, signer });
  });
task("withdrawWETH").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Vault tasks.

task(
  "queueLiquidity",
  "Call addWithdrawalQueueLiquidity() on the Vault to add WETH to the withdrawal queue"
).setAction(addWithdrawalQueueLiquidity);
task("queueLiquidity").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("allocate", "Call allocate() on the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .setAction(allocate);
task("allocate").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("capital", "Set the Vault's pauseCapital flag")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .addParam(
    "pause",
    "Whether to pause or unpause the capital allocation",
    true,
    types.boolean
  )
  .setAction(capital);
task("capital").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("rebase", "Call rebase() on the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .setAction(rebase);
task("rebase").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("yield", "Artificially generate yield on the OUSD Vault", yieldTask);

subtask("mint", "Mint OTokens from the Vault using collateral assets")
  .addOptionalParam(
    "asset",
    "Symbol of the collateral asset to deposit. eg WETH, wS, USDT, DAI or USDC",
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
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .addOptionalParam("min", "Minimum amount of OTokens to mint", 0, types.float)
  .addOptionalParam(
    "approve",
    "Approve the asset to the OETH Vault before the mint",
    true,
    types.boolean
  )
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

subtask("requestWithdrawal", "Request a withdrawal from a vault")
  .addParam(
    "amount",
    "The amount of oTokens to withdraw",
    undefined,
    types.float
  )
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .setAction(requestWithdrawal);
task("requestWithdrawal").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "claimWithdrawal",
  "Claim a previously requested withdrawal from a vault"
)
  .addParam(
    "requestId",
    "The id from the previous withdrawal request",
    undefined,
    types.int
  )
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH, OUSD or OS",
    undefined,
    types.string
  )
  .setAction(claimWithdrawal);
task("claimWithdrawal").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Dripper

subtask("collect", "Collect harvested rewards from the Dripper to the Vault")
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(collect);
task("collect").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("setDripDuration", "Set the Dripper duration")
  .addParam(
    "duration",
    "The number of seconds to drip harvested rewards",
    undefined,
    types.int
  )
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .setAction(setDripDuration);
task("setDripDuration").setAction(async (_, __, runSuper) => {
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
  .addOptionalParam(
    "output",
    "true will output to the console. false will use debug logs.",
    true,
    types.boolean
  )
  .setAction(curvePoolTask);
task("curvePool").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Curve Pools
subtask("amoStrat", "Dumps the current state of an AMO strategy")
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
    "output",
    "true will output to the console. false will use debug logs.",
    true,
    types.boolean
  )
  .addOptionalParam(
    "amm",
    "Type of pool. eg curve, balancer or swapx",
    "curve",
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

// AMO peg keeping
subtask(
  "amoMint",
  "AMO strategy mints OTokens and one-sided add to the Metapool"
)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam("amount", "Amount of OTokens to mint", 0, types.float)
  .setAction(mintAndAddOTokensTask);
task("amoMint").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "amoBurn",
  "AMO strategy does a one-sided remove of OTokens from the Metapool which are then burned."
)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "amount",
    "Amount of Curve LP tokens to burn for removed OTokens",
    0,
    types.float
  )
  .setAction(removeAndBurnOTokensTask);
task("amoBurn").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "amoRemove",
  "AMO strategy does a one-sided remove of ETH from the Metapool and adds the asset to the vault"
)
  .addOptionalParam(
    "symbol",
    "Symbol of the OToken. eg OETH or OUSD",
    "OETH",
    types.string
  )
  .addParam(
    "amount",
    "Amount of Metapool LP tokens to burn for removed assets",
    0,
    types.float
  )
  .setAction(removeOnlyAssetsTask);
task("amoRemove").setAction(async (_, __, runSuper) => {
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

task("proxyUpgrades", "Lists all proxy implementation changes")
  .addParam(
    "contract",
    "Name, eg OETHVaultProxy, or address of the proxy contract",
    undefined,
    types.string
  )
  .addOptionalParam(
    "from",
    "Block to query transaction events from. (default: deployment block)",
    10884563,
    types.int
  )
  .addOptionalParam(
    "to",
    "Block to query transaction events to. (default: current block)",
    0,
    types.int
  )
  .setAction(proxyUpgrades);

// Governable

task("governor", "Gets the governor of a Governable contract")
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .setAction(governor);

task(
  "transferGovernance",
  "Start transfer of governance for a Governable contract"
)
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .addParam("governor", "Address of the new governor", undefined, types.string)
  .setAction(transferGovernance);

task(
  "claimGovernance",
  "Complete the transfer of governance for a Governable contract"
)
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .setAction(claimGovernance);

task("transferToken", "Transfer tokens in a contract to the governor")
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .addParam("symbol", "Symbol of the token", undefined, types.string)
  .addOptionalParam(
    "amount",
    "The amount of tokens to transfer. (default: balance)",
    undefined,
    types.float
  )
  .setAction(transferToken);

// Strategy

task("checkBalance", "Gets the asset balance of a strategy")
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .addParam(
    "symbol",
    "Symbol of the token. eg WETH, CRV, CVX, BAL or AURA",
    undefined,
    types.string
  )
  .setAction(checkBalance);

task("getRewardTokenAddresses", "Gets the reward tokens of a strategy")
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .setAction(getRewardTokenAddresses);

task("setRewardTokenAddresses", "Sets the reward token of a strategy")
  .addParam(
    "proxy",
    "Name of the proxy contract or contract name if no proxy. eg OETHVaultProxy or OETHZapper",
    undefined,
    types.string
  )
  .addParam(
    "symbol",
    "Symbol of the token. eg WETH, CRV, CVX, BAL or AURA",
    undefined,
    types.string
  )
  .setAction(setRewardTokenAddresses);

// Harvester

task("harvest", "Harvest and swap rewards for a strategy")
  .addParam(
    "strategy",
    "Name of the strategy proxy contract or address. eg NativeStakingSSVStrategyProxy",
    undefined,
    types.string
  )
  .addOptionalParam(
    "harvester",
    "Name of the harvester proxy contract or address",
    "OETHHarvesterProxy",
    types.string
  )
  .setAction(harvestAndSwap);

// SSV

subtask("getClusterInfo", "Print out information regarding SSV cluster")
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    "",
    types.string
  )
  .addParam(
    "owner",
    "Address of the cluster owner which is the native staking strategy",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const { chainId } = await ethers.provider.getNetwork();
    const networkName = await getNetworkName();
    const ssvNetwork = addresses[networkName].SSVNetwork;

    log(
      `Fetching cluster info for cluster owner ${taskArgs.owner} with operator ids: ${taskArgs.operatorids} from the ${networkName} network using ssvNetworkContract ${ssvNetwork}`
    );
    await printClusterInfo({
      ...taskArgs,
      ownerAddress: taskArgs.owner,
      chainId: chainId,
      ssvNetwork,
    });
  });
task("getClusterInfo").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "depositSSV",
  "Deposit SSV tokens from the native staking strategy into an SSV Cluster"
)
  .addParam("amount", "Amount of SSV tokens to deposit", undefined, types.float)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .setAction(depositSSV);
task("depositSSV").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "withdrawSSV",
  "Withdraw SSV tokens from an SSV Cluster to the native staking strategy"
)
  .addParam("amount", "Amount of SSV tokens", undefined, types.float)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .setAction(withdrawSSV);
task("withdrawSSV").setAction(async (_, __, runSuper) => {
  return runSuper();
});

/**
 * The compounding staking proxy needs to be deployed via the defender relayer because the SSV network
 * grants the SSV rewards to the deployer of the contract. And we want the Defender Relayer to be
 * the recipient
 */
subtask(
  "deployStakingProxy",
  "Deploy the compounding staking proxy via the Defender Relayer"
).setAction(async () => {
  const signer = await getSigner();

  log(`Deploy CompoundingStakingSSVStrategyProxy`);
  const stakingProxyFactory = await ethers.getContractFactory(
    `CompoundingStakingSSVStrategyProxy`
  );
  const contract = await stakingProxyFactory.connect(signer).deploy();
  await contract.deployed();
  log(`Address of deployed staking contract is: ${contract.address}`);
});
task("deployStakingProxy").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Validator Operations

subtask(
  "registerValidators",
  "Creates the required amount of new SSV validators and stakes ETH"
)
  .addOptionalParam(
    "days",
    "SSV Cluster operational time in days",
    2,
    types.int
  )
  .addOptionalParam(
    "validators",
    "The number of validators to register. defaults to the max that can be registered",
    undefined,
    types.int
  )
  .addOptionalParam("clear", "Clear storage", false, types.boolean)
  .addOptionalParam(
    "ssv",
    "Override the days option and set the amount of SSV to deposit to the cluster.",
    undefined,
    types.float
  )
  .addOptionalParam(
    "uuid",
    "uuid of P2P's request SSV validator API call. Used to reprocess a registration that failed to get the SSV request status.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const config = await validatorOperationsConfig(taskArgs);
    const signer = await getSigner();
    await registerValidators({ ...config, signer });
  });
task("registerValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "stakeValidators",
  "Creates the required amount of new SSV validators and stakes ETH"
)
  .addOptionalParam(
    "uuid",
    "uuid of P2P's request SSV validator API call",
    undefined,
    types.string
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const config = await validatorOperationsConfig(taskArgs);
    const signer = await getSigner();
    await stakeValidators({ ...config, signer });
  });
task("stakeValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("exitValidators", "Starts the exit process from validators")
  .addParam(
    "pubkeys",
    "Comma separated validator public keys",
    undefined,
    types.string
  )
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await exitValidators({ ...taskArgs, signer });
  });
task("exitValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "removeValidators",
  "Removes validators from the SSV cluster after they have exited the beacon chain"
)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addParam(
    "pubkeys",
    "Comma separated validator public keys",
    undefined,
    types.string
  )
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await removeValidators({ ...taskArgs, signer });
  });
task("removeValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "doAccounting",
  "Account for consensus rewards and validator exits in the Native Staking Strategy"
)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async ({ index }) => {
    const signer = await getSigner();

    const nativeStakingStrategy = await resolveNativeStakingStrategyProxy(
      index
    );

    await doAccounting({
      signer,
      nativeStakingStrategy,
    });
  });
task("doAccounting").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "manuallyFixAccounting",
  "Fix an accounting failure in a Native Staking Strategy"
)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addOptionalParam(
    "validators",
    "The delta of validators. Can be positive or negative.",
    0,
    types.int
  )
  .addOptionalParam(
    "rewards",
    "The delta of consensus rewards. Can be positive or negative.",
    "0",
    types.string
  )
  .addOptionalParam(
    "vault",
    "The amount of Ether to convert to WETH and send to the Vault.",
    "0",
    types.string
  )
  .setAction(async ({ index, rewards, validators, vault }) => {
    const signer = await getSigner();

    const nativeStakingStrategy = await resolveNativeStakingStrategyProxy(
      index
    );

    await manuallyFixAccounting({
      signer,
      nativeStakingStrategy,
      validatorsDelta: validators,
      consensusRewardsDelta: rewards,
      ethToVaultAmount: vault,
    });
  });
task("manuallyFixAccounting").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "resetStakeETHTally",
  "Resets the amount of Ether staked back to zero"
).addOptionalParam(
  "index",
  "The number of the Native Staking Contract deployed.",
  undefined,
  types.int
);
subtask(
  "resetStakeETHTally",
  "Resets the amount of Ether staked back to zero"
).setAction(async () => {
  const signer = await getSigner();
  await resetStakeETHTally({ signer });
});
task("resetStakeETHTally").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "setStakeETHThreshold",
  "Sets the amount of Ether than can be staked before needing a reset"
)
  .addParam("amount", "Amount in ether", undefined, types.int)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await setStakeETHThreshold({ ...taskArgs, signer });
  });
task("setStakeETHThreshold").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("fixAccounting", "Fix the accounting of the Native Staking Strategy.")
  .addOptionalParam(
    "validators",
    "The number of validators to adjust up or down (negative)",
    0,
    types.int
  )
  .addOptionalParam(
    "rewards",
    "The number of consensus rewards to adjust up or down (negative) in ether",
    0,
    types.float
  )
  .addOptionalParam(
    "ether",
    "amount of ether that gets wrapped into WETH and sent to the Vault",
    0,
    types.float
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await fixAccounting({ ...taskArgs, signer });
  });
task("fixAccounting").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "pauseStaking",
  "Pause the staking of the Native Staking Strategy"
).addOptionalParam(
  "index",
  "The number of the Native Staking Contract deployed.",
  undefined,
  types.int
);
subtask(
  "pauseStaking",
  "Pause the staking of the Native Staking Strategy"
).setAction(async () => {
  const signer = await getSigner();
  await pauseStaking({ signer });
});
task("pauseStaking").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "snapStaking",
  "Takes a snapshot of the key Native Staking Strategy data at a block"
)
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "admin",
    "Include addresses of admin accounts",
    true,
    types.boolean
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await snapStaking({ ...taskArgs, signer });
  });
task("snapStaking").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("snapAero", "Takes a snapshot of the Aerodrome Strategy at a block")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(snapAero);
task("snapAero").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("snapVault", "Takes a snapshot of a OETH Vault")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(snapVault);
task("snapVault").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("snapValidators", "Takes a snapshot of a validator")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .addParam(
    "pubkeys",
    "Comma separated list of validator public keys",
    undefined,
    types.string
  )
  .setAction(snapValidators);
task("snapValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "depositRoot",
  "Calculates the Beacon chain deposit root for a validator"
)
  .addParam(
    "pubkey",
    "The validator's public key in hex format",
    undefined,
    types.string
  )
  .addParam(
    "sig",
    "The validator's signature in hex format",
    undefined,
    types.string
  )
  .addParam(
    "owner",
    "The withdrawal address of the validator in hex format",
    undefined,
    types.string
  )
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addOptionalParam(
    "type",
    "Validator type. 0x00, 0x01 or 0x02",
    "0x02",
    types.string
  )
  .addOptionalParam("amount", "The deposit amount.", 32, types.float)
  .setAction(async (taskArgs) => {
    const root = await calcDepositRoot(
      taskArgs.owner,
      taskArgs.type,
      taskArgs.pubkey,
      taskArgs.sig,
      taskArgs.amount
    );
    console.log(`Deposit data root: ${root}`);
  });
task("depositRoot").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Encryption
subtask(
  "encryptMasterPrivateKey",
  "Encrypt the master validator private key whose public key pair is used " +
    "by the P2P service to encrypt each validator private key."
)
  .addParam(
    "privateKey",
    "Private key to be encrypted and if needed used for validator private key decryption",
    undefined,
    types.string
  )
  .setAction(encryptMasterPrivateKey);
task("encryptMasterPrivateKey").setAction(async (_, __, runSuper) => {
  return runSuper();
});

/* only needed in critical situation where we need access to the master private key to decrypt
 * the P2P encoded validator private keys.
 */
subtask(
  "decryptMasterPrivateKey",
  "Decrypt the master validator private key."
).setAction(decryptMasterPrivateKey);
task("decryptMasterPrivateKey").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("genECDHKey", "Generate Elliptic-curve Diffie–Hellman (ECDH) key pair")
  .addOptionalParam(
    "privateKey",
    "Private key to encrypt the message with in base64 format",
    undefined,
    types.string
  )
  .addOptionalParam(
    "displayPk",
    "Display the private key in hex format in the console",
    false,
    types.boolean
  )
  .setAction(genECDHKey);
task("genECDHKey").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "decrypt",
  "Decrypt a message using a Elliptic-curve Diffie–Hellman (ECDH) key pair"
)
  .addOptionalParam(
    "privateKey",
    "Private key to decrypt the message with in hex format without the 0x prefix. If not provided, the encrypted private key in VALIDATOR_MASTER_ENCRYPTED_PRIVATE_KEY will be used.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "encryptedKey",
    "Used if pubkey is not provided. The encrypted validator private key returned from P2P API in base64 format.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "pubkey",
    "Public key of the validator whose private key is to be fetched in hex format. If not provided, the encryptedKey option must be used.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "displayPk",
    "Display the private key in hex format in the console",
    false,
    types.boolean
  )
  .setAction(decryptValidatorKey);
task("decrypt").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "masterDecrypt",
  "Decrypt a message using a Elliptic-curve Diffie–Hellman (ECDH) key pair by using the " +
    "master validator encoding key decrypted by AWS KMS service."
)
  .addParam(
    "message",
    "Encrypted validator key returned form P2P API",
    undefined,
    types.string
  )
  .setAction(decryptValidatorKeyWithMasterKey);
task("masterDecrypt").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "signMessage",
  "Sign a message using a Elliptic-curve Diffie–Hellman (ECDH) private key"
)
  .addParam("message", "Message to be signed", undefined, types.string)
  .setAction(async (taskArgs) => {
    const signer = await getSigner();

    await signMessage({ ...taskArgs, signer });
  });
task("signMessage").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Defender
subtask(
  "setActionVars",
  "Set environment variables on a Defender Actions. eg DEBUG=origin*"
)
  .addParam("id", "Identifier of the Defender Actions", undefined, types.string)
  .addOptionalParam(
    "name",
    "Name of the environment variable to set. eg HOODI_BEACON_PROVIDER_URL",
    undefined,
    types.string
  )
  .setAction(setActionVars);
task("setActionVars").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Simulations
subtask(
  "deployForceEtherSender",
  "Deploy a ForceEtherSender contract for simulating hacks"
).setAction(deployForceEtherSender);
task("deployForceEtherSender").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("forceSend", "Force send ETH to a recipient using self destruct")
  .addParam(
    "sender",
    "Address of the deployed ForceEtherSender contract",
    undefined,
    types.string
  )
  .addParam(
    "recipient",
    "Address of the contract to receive the Ether",
    undefined,
    types.string
  )
  .setAction(forceSend);
task("forceSend").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("mine", "Mines a number of blocks")
  .addOptionalParam("blocks", "The number of blocks to mine", 1, types.int)
  .setAction(async ({ blocks }) => {
    await advanceBlocks(blocks);
  });
task("mine").setAction(async (_, __, runSuper) => {
  return runSuper();
});

// Sonic Staking Operations
subtask(
  "sonicDefaultValidator",
  "Set the default validator for the Sonic Staking Strategy"
)
  .addParam("id", "Validator identifier. eg 18", undefined, types.int)
  .setAction(setDefaultValidator);
task("sonicDefaultValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("sonicUndelegate", "Remove liquidity from a Sonic validator")
  .addOptionalParam(
    "id",
    "Validator identifier. 15, 16, 17 or 18",
    undefined,
    types.int
  )
  .addOptionalParam(
    "amount",
    "Amount of liquidity to remove",
    undefined,
    types.float
  )
  .addOptionalParam(
    "buffer",
    "Percentage of total assets to keep as buffer in basis points. 100 = 1%",
    50,
    types.float
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();

    await undelegateValidator({
      ...taskArgs,
      bufferPct: taskArgs.buffer,
      signer,
    });
  });
task("sonicUndelegate").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "sonicWithdraw",
  "Withdraw native S from a previously undelegated validator"
).setAction(async () => {
  const signer = await getSigner();

  await withdrawFromSFC({ signer });
});
task("sonicWithdraw").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("sonicStaking", "Snap of the Sonic Staking Strategy")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(snapSonicStaking);
task("sonicStaking").setAction(async (_, __, runSuper) => {
  return runSuper();
});

task("lzBridgeToken")
  .addParam("amount", "Amount to bridge")
  .addParam("destnetwork", "Destination network")
  .addOptionalParam("recipient", "Recipient address")
  .addOptionalParam("gaslimit", "Gas limit")
  .addOptionalParam("dryrun", "Print tx data without sending")
  .setAction(async (taskArgs) => {
    await lzBridgeToken(taskArgs, hre);
  });

task("lzSetConfig")
  .addParam("destnetwork", "Destination network")
  .addParam("dvns", "Comma separated list of DVN addresses")
  .addParam("confirmations", "Number of confirmations")
  .addParam("dvncount", "Number of required DVNs")
  .setAction(async (taskArgs) => {
    await lzSetConfig(taskArgs, hre);
  });

// Beacon Chain Operations
subtask("depositValidator", "Deposits ETH to a validator on the Beacon chain")
  .addParam("pubkey", "Validator public key in hex format with a 0x prefix")
  .addParam("sig", "Validator signature in hex format with a 0x prefix")
  .addParam(
    "cred",
    "Validator withdrawal credentials in hex format with a 0x prefix"
  )
  .addParam(
    "root",
    "Beacon chain deposit data root in hex format with a 0x prefix"
  )
  .addOptionalParam("amount", "Amount to deposit", 32, types.float)
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await depositValidator({ ...taskArgs, signer });
  });
task("depositValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "setRegistrator",
  "Set the registrator of the compounding staking strategy"
)
  .addParam("account", "Address of the registrator", undefined, types.string)
  .setAction(setRegistrator);
task("setRegistrator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "beaconRoot",
  "Gets the parent beacon block root for an execution layer block from the BeaconRoot contract"
)
  .addParam(
    "block",
    "Execution layer block number to get the parent beacon block root for",
    undefined,
    types.int
  )
  .addOptionalParam(
    "live",
    "Use live chain (mainnet or testnet) to get block timestamp. Not the local fork",
    true,
    types.boolean
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await beaconRoot({ ...taskArgs, signer });
  });
task("beaconRoot").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "copyBeaconRoot",
  "Copies a parent beacon block root from mainnet to a local BeaconRoot contract (EIP-4788)"
)
  .addParam(
    "block",
    "Execution layer block number to set the parent root for",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await copyBeaconRoot({ ...taskArgs, signer });
  });
task("copyBeaconRoot").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "mockBeaconRoot",
  "Replaces the BeaconRoot contract (EIP-4788) with a mocked one for testing purposes"
).setAction(mockBeaconRoot);
task("mockBeaconRoot").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("getValidator", "Gets the details of a validator")
  .addOptionalParam(
    "index",
    "Index of the validator on the Beacon chain",
    undefined,
    types.int
  )
  .addOptionalParam(
    "pubkey",
    "Validator public key in hex format with a 0x prefix"
  )
  .addOptionalParam(
    "slot",
    "Beacon chain slot. Default head",
    undefined,
    types.int
  )
  .setAction(getValidator);
task("getValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("verifyValidator", "Verify a validator on the Beacon chain")
  .addParam(
    "index",
    "Index of the validator on the Beacon chain",
    undefined,
    types.int
  )
  .addOptionalParam(
    "slot",
    "Any slot after the validator was registered on the Beacon chain. Default latest",
    undefined,
    types.int
  )
  .addOptionalParam(
    "dryrun",
    "Do not call verifyBalances on the strategy contract. Just log the params including the proofs",
    false,
    types.boolean
  )
  .addOptionalParam(
    "cred",
    "Override the withdrawal credential. Used when generating proofs for unit tests or the deposit was front-run.",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await verifyValidator({ ...taskArgs, signer });
  });
task("verifyValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("verifyDeposit", "Verify a deposit on the Beacon chain")
  .addParam(
    "root",
    "The pending deposit root emitted in the `ETHStaked` event from the `stakeETH` function",
    undefined,
    types.string
  )
  .addOptionalParam(
    "slot",
    "The slot on or after the deposit was process on the beacon chain. Default deposit processed slot",
    undefined,
    types.int
  )
  .addOptionalParam(
    "dryrun",
    "Do not call verifyDeposit on the strategy contract. Just log the params including the proofs",
    false,
    types.boolean
  )
  .addOptionalParam(
    "test",
    "Used for generating unit test data.",
    false,
    types.boolean
  )
  .addOptionalParam(
    "index",
    "Override the validator with the index of a test validator. Used when generating proofs for unit tests.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await verifyDeposit({ ...taskArgs, signer });
  });
task("verifyDeposit").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("verifyBalances", "Verify validator balances on the Beacon chain")
  .addOptionalParam(
    "slot",
    "The slot snapBalances was executed. Default: last balances snapshot",
    undefined,
    types.int
  )
  .addOptionalParam(
    "indexes",
    "Comma separated list of validator indexes. Default: strategy's active validators",
    undefined,
    types.string
  )
  .addOptionalParam(
    "deposits",
    "Comma separated list of indexes to beacon chain pending deposits used for generating unit test data",
    undefined,
    types.string
  )
  .addOptionalParam(
    "dryrun",
    "Do not call verifyBalances on the strategy contract. Just log the params including the proofs",
    false,
    types.boolean
  )
  .addOptionalParam(
    "test",
    "Used for generating unit test data.",
    false,
    types.boolean
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await verifyBalances({ ...taskArgs, signer });
  });
task("verifyBalances").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "requestNewValidator",
  "Calls P2P's Create SSV Request to prepare a new SSV compounding (0x02) validator"
)
  .addOptionalParam(
    "days",
    "SSV Cluster operational time in days",
    1,
    types.int
  )
  .setAction(async (taskArgs) => {
    await registerValidatorCreateRequest(taskArgs);
    console.log("Once the validator is created run: registerValidatorUuid");
  });
task("requestNewValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "registerValidator",
  "Registers a new compounding validator in a SSV cluster"
)
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .addOptionalParam(
    "uuid",
    "The uuid that has been used to create the request using requestNewValidator",
    undefined,
    types.string
  )
  .addOptionalParam(
    "pubkey",
    "If no uuid, the validator's public key in hex format with a 0x prefix",
    undefined,
    types.string
  )
  .addOptionalParam(
    "shares",
    "If no uuid, SSV shares data",
    undefined,
    types.string
  )
  .addOptionalParam(
    "ssv",
    "Amount of SSV to deposit to the cluster.",
    0,
    types.int
  )
  .setAction(async (taskArgs) => {
    await registerValidator(taskArgs);
  });
task("registerValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "withdrawValidator",
  "Requests a partial or full withdrawal from a compounding validator"
)
  .addParam(
    "pubkey",
    "The validator's public key in hex format with a 0x prefix",
    undefined,
    types.string
  )
  .addOptionalParam(
    "amount",
    "Amount of ETH to withdraw from the validator. A zero amount is a full exit.",
    0,
    types.float
  )
  .addOptionalParam(
    "direct",
    "Withdraw via the staking contract or directly to the request withdrawal contract",
    false,
    types.boolean
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    if (taskArgs.direct) {
      await requestValidatorWithdraw({ ...taskArgs, signer });
    } else {
      await withdrawValidator({ ...taskArgs, signer });
    }
  });
task("withdrawValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "removeValidator",
  "Removes a registered or exited compounding validator from the SSV cluster"
)
  .addParam(
    "pubkey",
    "The validator's public key in hex format with a 0x prefix",
    undefined,
    types.string
  )
  .addParam(
    "operatorids",
    "Comma separated operator ids. E.g. 342,343,344,345",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await removeValidator({ ...taskArgs, signer });
  });
task("removeValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "autoValidatorWithdrawals",
  "Automatically withdraws funds from a validator"
)
  .addParam(
    "buffer",
    "Withdrawal buffer in basis points. 100 = 1%",
    100,
    types.int
  )
  .addParam(
    "dryrun",
    "Do not send any txs to the staking strategy contract",
    false,
    types.boolean
  )
  .setAction(async (taskArgs) => {
    const signer = await getSigner();
    await autoValidatorWithdrawals({ ...taskArgs, signer });
  });
task("autoValidatorWithdrawals").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "stakeValidatorUuid",
  "Converts WETH to ETH and deposits to a validator from the Compounding Staking Strategy"
)
  .addParam(
    "uuid",
    "The P2P uuid used to create the Create SSV validators request",
    undefined,
    types.string
  )
  .addOptionalParam(
    "dryrun",
    "Do not call stakeEth on the strategy contract. Just log the params and verify the deposit signature",
    false,
    types.boolean
  )
  .setAction(stakeValidator);
task("stakeValidatorUuid").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "stakeValidator",
  "Converts WETH to ETH and deposits to a validator from the Compounding Staking Strategy"
)
  .addParam(
    "pubkey",
    "The validator's public key in hex format with a 0x prefix",
    undefined,
    types.string
  )
  .addOptionalParam(
    "sig",
    "The validator's deposit signature in hex format with a 0x prefix",
    undefined,
    types.string
  )
  .addParam(
    "amount",
    "Amount of ETH to deposit to the validator.",
    undefined,
    types.float
  )
  .addOptionalParam(
    "withdrawalCredentials",
    "Withdrawal credentials of the validator",
    undefined,
    types.string
  )
  .addOptionalParam(
    "depositMessageRoot",
    "Deposit message root provided by p2p",
    undefined,
    types.string
  )
  .addOptionalParam(
    "forkVersion",
    "Fork version of the beacon chain. Required for validating the BLS signature",
    "10000910",
    types.string
  )
  .addOptionalParam(
    "dryrun",
    "Do not call stakeEth on the strategy contract. Just log the params and verify the deposit signature",
    false,
    types.boolean
  )
  .setAction(stakeValidator);
task("stakeValidator").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "snapBalances",
  "Takes a snapshot of the staking strategy's balance"
).setAction(snapBalances);
task("snapBalances").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("snapStakingStrat", "Dumps the staking strategy's data")
  .addOptionalParam(
    "block",
    "Block number. (default: latest)",
    undefined,
    types.int
  )
  .setAction(snapStakingStrategy);
task("snapStakingStrat").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask(
  "tenderlySync",
  "Fetches all contracts from deployment descriptors and uploads them to Tenderly if they are not there yet."
).setAction(tenderlySync);
task("tenderlySync").setAction(async (_, __, runSuper) => {
  return runSuper();
});

subtask("tenderlyUpload", "Uploads a contract to Tenderly.")
  .addParam("name", "The contract's name", undefined, types.string)
  .setAction(tenderlyUpload);
task("tenderlyUpload").setAction(async (_, __, runSuper) => {
  return runSuper();
});
