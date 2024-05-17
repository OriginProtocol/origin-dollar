const { subtask, task, types } = require("hardhat/config");
const { fund } = require("./account");
const { debug } = require("./debug");
const { env } = require("./env");
const { execute, executeOnFork, proposal, governors } = require("./governance");
const { smokeTest, smokeTestCheck } = require("./smokeTest");
const addresses = require("../utils/addresses");
const { getDefenderSigner } = require("../utils/signers");
const { networkMap } = require("../utils/hardhat-helpers");
const { resolveContract } = require("../utils/resolvers");
const { KeyValueStoreClient } = require("defender-kvstore-client");
const { operateValidators } = require("./validator");
const { formatUnits } = require("ethers/lib/utils");

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
  curveAddTask,
  curveRemoveTask,
  curveSwapTask,
  curvePoolTask,
} = require("./curve");
const { depositSSV, printClusterInfo } = require("./ssv");
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
} = require("./strategy");

// can not import from utils/deploy since that imports hardhat globally
const withConfirmation = async (
  deployOrTransactionPromise,
  logContractAbi = false
) => {
  const hre = require("hardhat");

  const result = await deployOrTransactionPromise;
  const receipt = await hre.ethers.provider.waitForTransaction(
    result.receipt ? result.receipt.transactionHash : result.hash,
    3
  );

  result.receipt = receipt;
  return result;
};

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
    "output",
    "true will output to the console. false will use debug logs.",
    true,
    types.boolean
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
    "Amount of Metapool LP tokens to burn for removed OTokens",
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

// SSV

subtask("getClusterInfo", "Print out information regarding SSV cluster")
  .addParam(
    "operatorids",
    "4 operator ids separated with a dot: same as IP format. E.g. 60.79.220.349",
    "",
    types.string
  )
  .addParam(
    "owner",
    "Address of the cluster owner. Default to NodeDelegator",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const network = await ethers.provider.getNetwork();
    const ssvNetwork = addresses[networkMap[network.chainId]].SSVNetwork;

    log(
      `Fetching cluster info for cluster owner ${taskArgs.owner} with operator ids: ${taskArgs.operatorids} from the ${network.name} network using ssvNetworkContract ${ssvNetwork}`
    );
    await printClusterInfo({
      ...taskArgs,
      ownerAddress: taskArgs.owner,
      chainId: network.chainId,
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
  .addParam(
    "operatorids",
    "4 operator ids separated with a dot: same as IP format. E.g. 60.79.220.349",
    undefined,
    types.string
  )
  .setAction(depositSSV);
task("depositSSV").setAction(async (_, __, runSuper) => {
  return runSuper();
});

/**
 * The native staking proxy needs to be deployed via the defender relayer because the SSV networkd
 * grants the SSV rewards to the deployer of the contract. And we want the Defender Relayer to be
 * the recipient
 */
subtask("deployNativeStakingProxy", "Deploy the native staking proxy via the Defender Relayer")
  .setAction(async (taskArgs) => {
    const defenderSigner = await getDefenderSigner();

    log("Deploy NativeStakingSSVStrategyProxy");
    const { governorAddr, deployerAddr } = await getNamedAccounts();

    const nativeStakingProxyFactory = await ethers.getContractFactory("NativeStakingSSVStrategyProxy");
    const contract = await nativeStakingProxyFactory.connect(defenderSigner).deploy();
    await contract.deployed();
    log(`Address of deployed contract is: ${contract.address}`)
  });
task("deployNativeStakingProxy").setAction(async (_, __, runSuper) => {
  return runSuper();
});

/**
 * Governance of the SSV strategy proxy needs to be transferred to the deployer address so that 
 * the deployer is able to initialize the proxy
 */
subtask("transferGovernanceNativeStakingProxy", "Transfer governance of the proxy from the the Defender Relayer")
  .addParam("address", "Address of the new governor", undefined, types.string)
  .setAction(async (taskArgs) => {
    const defenderSigner = await getDefenderSigner();

    log("Tranfer governance of NativeStakingSSVStrategyProxy");
    const { governorAddr, deployerAddr } = await getNamedAccounts();

    const nativeStakingProxyFactory = await ethers.getContract("NativeStakingSSVStrategyProxy");
    await withConfirmation(
      nativeStakingProxyFactory
        .connect(defenderSigner)
        .transferGovernance(taskArgs.address)
    );
    log(`Governance of NativeStakingSSVStrategyProxy transferred to  ${taskArgs.address}`)
  });
task("transferGovernanceNativeStakingProxy").setAction(async (_, __, runSuper) => {
  return runSuper();
});


// Defender
subtask(
  "operateValidators",
  "Creates the required amount of new SSV validators and stakes ETH"
)
  .addOptionalParam("index", "Index of Native Staking contract", 1, types.int)
  .addOptionalParam(
    "stake",
    "Stake 32 ether after registering a new SSV validator",
    true,
    types.boolean
  )
  .addOptionalParam(
    "days",
    "SSV Cluster operational time in days",
    40,
    types.int
  )
  .addOptionalParam("clear", "Clear storage", true, types.boolean)
  .setAction(async (taskArgs) => {
    const network = await ethers.provider.getNetwork();
    const isMainnet = network.chainId === 1;
    const isHolesky = network.chainId === 17000;
    const addressesSet = isMainnet ? addresses.mainnet : addresses.holesky;

    if (!isMainnet && !isHolesky) {
      throw new Error(
        "operate validatos is supported on Mainnet and Holesky only"
      );
    }

    const storeFilePath = require("path").join(
      __dirname,
      "..",
      `.localKeyValueStorage${isMainnet ? "Mainnet" : "Holesky"}`
    );

    const store = new KeyValueStoreClient({ path: storeFilePath });
    const signer = await getDefenderSigner();

    const WETH = await ethers.getContractAt("IWETH9", addressesSet.WETH);
    const SSV = await ethers.getContractAt("IERC20", addressesSet.SSV);

    // TODO: use index to target different native staking strategies when we have more than 1
    const nativeStakingStrategy = await resolveContract(
      "NativeStakingSSVStrategyProxy",
      "NativeStakingSSVStrategy"
    );

    log(
      "Balance of SSV tokens on the native staking contract: ",
      formatUnits(await SSV.balanceOf(nativeStakingStrategy.address))
    );

    const contracts = {
      nativeStakingStrategy,
      WETH,
    };
    const feeAccumulatorAddress =
      await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

    const p2p_api_key = isMainnet
      ? process.env.P2P_MAINNET_API_KEY
      : process.env.P2P_HOLESKY_API_KEY;
    if (!p2p_api_key) {
      throw new Error(
        "P2P API key environment variable is not set. P2P_MAINNET_API_KEY or P2P_HOLESKY_API_KEY"
      );
    }
    const p2p_base_url = isMainnet ? "api.p2p.org" : "api-test-holesky.p2p.org";

    const config = {
      feeAccumulatorAddress,
      p2p_api_key,
      p2p_base_url,
      // how much SSV (expressed in days of runway) gets deposited into the
      // SSV Network contract on validator registration. This is calculated
      // at a Cluster level rather than a single validator.
      validatorSpawnOperationalPeriodInDays: taskArgs.days,
      stake: taskArgs.stake,
      clear: taskArgs.clear,
    };

    await operateValidators({
      signer,
      contracts,
      store,
      config,
    });
  });
task("operateValidators").setAction(async (_, __, runSuper) => {
  return runSuper();
});
