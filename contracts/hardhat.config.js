const ethers = require("ethers");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
require("@openzeppelin/hardhat-upgrades");

const { accounts, fund, mint, redeem, transfer } = require("./tasks/account");
const { debug } = require("./tasks/debug");
const { env } = require("./tasks/env");
const {
  execute,
  executeOnFork,
  proposal,
  governors,
} = require("./tasks/governance");
const { balance } = require("./tasks/ousd");
const { smokeTest, smokeTestCheck } = require("./tasks/smokeTest");
const {
  storeStorageLayoutForAllContracts,
  assertStorageLayoutChangeSafe,
  assertStorageLayoutChangeSafeForAll,
} = require("./tasks/storageSlots");
const {
  isAdjusterLocked,
  fundCompAccountsWithEth,
  claimOGN,
  claimOUSD,
  checkOUSDBalances,
  supplyStakingContractWithOGN,
} = require("./tasks/compensation");
const {
  allocate,
  capital,
  harvest,
  reallocate,
  rebase,
  yield,
} = require("./tasks/vault");

const MAINNET_DEPLOYER = "0x71F78361537A6f7B6818e7A760c8bC0146D93f50";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x830622BDd79CC677eE6594E20bBda5B26568b781";
// Multi-sig that controls the Governor. Aka "Guardian".
const MAINNET_MULTISIG = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
const MAINNET_STRATEGIST = "0xf14bbdf064e3f67f51cd9bd646ae3716ad938fdc";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

// Environment tasks.
task("env", "Check env vars are properly set for a Mainnet deployment", env);

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});
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
  .addOptionalParam("num", "Number of accounts to mint for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of OUSD to mint")
  .setAction(redeem);
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
task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("assets", "Address of asset to reallocate")
  .addParam("amounts", "Amount of asset to reallocate")
  .setAction(reallocate);

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

module.exports = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: 1,
    },
    localhost: {
      timeout: 60000,
    },
    rinkeby: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
    timeout: 40000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: 0,
      mainnet: MAINNET_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: process.env.FORK === "true" ? MAINNET_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? MAINNET_GOVERNOR : 1,
      mainnet: MAINNET_GOVERNOR,
    },
    guardianAddr: {
      default: 1,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
    },
    strategistAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_STRATEGIST : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_STRATEGIST : 0,
      mainnet: MAINNET_STRATEGIST,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
