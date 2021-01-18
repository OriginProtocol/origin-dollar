const ethers = require("ethers");
const { utils } = require("ethers");
const { formatUnits } = utils;

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");

const { accounts, fund, mint } = require("./tasks/account");
const { debug } = require("./tasks/debug");
const { env } = require("./tasks/env");
const { execute, executeOnFork, proposal } = require("./tasks/governance");
const { balance } = require("./tasks/ousd");
const {
  isAdjusterLocked,
  fundCompAccountsWithEth,
  claimAllAsUser,
  checkOUSDBalances,
} = require("./tasks/compensation");
const {
  allocate,
  capital,
  harvest,
  reallocate,
  rebase,
} = require("./tasks/vault");

const MAINNET_DEPLOYER = "0x71F78361537A6f7B6818e7A760c8bC0146D93f50";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x8e7bDFeCd1164C46ad51b58e49A611F954D23377";
const MAINNET_MULTISIG = "0xe011fa2a6df98c69383457d87a056ed0103aa352";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;

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
  .setAction(fund);
task("mint", "Mint OUSD on local or fork")
  .addOptionalParam("num", "Number of accounts to mint for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of OUSD to mint")
  .setAction(mint);

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
task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("asset", "Address of asset to reallocate")
  .addParam("amount", "Amount of asset to reallocate")
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

// Compensation tasks
task("isAdjusterLocked", "Is adjuster on Compensation claims locked").setAction(
  isAdjusterLocked
);
task(
  "fundCompAccountsWithEth",
  "Fund compensation accounts with minimal eth"
).setAction(fundCompAccountsWithEth);
task(
  "claimAll",
  "Claim compensation as each user in the reimbursements"
).setAction(claimAllAsUser);
task(
  "checkOUSDBalances",
  "Check ousd balances of contract and accounts"
).setAction(checkOUSDBalances);

module.exports = {
  solidity: {
    version: "0.5.11",
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
      mainnet: MAINNET_GOVERNOR,
    },
    guardianAddr: {
      default: 1,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
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
