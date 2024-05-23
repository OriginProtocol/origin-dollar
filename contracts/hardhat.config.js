require("dotenv").config();
const ethers = require("ethers");
const { task } = require("hardhat/config");
const {
  isFork,
  isArbitrumFork,
  isHoleskyFork,
  isHolesky,
  isForkTest,
  isArbForkTest,
  isHoleskyForkTest,
  providerUrl,
  arbitrumProviderUrl,
  holeskyProviderUrl,
  adjustTheForkBlockNumber,
  getHardhatNetworkProperties,
  isBaseFork,
  baseProviderUrl,
  isBase,
  isBaseForkTest,
} = require("./utils/hardhat-helpers.js");

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-tracer");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");

require("./tasks/tasks");
const { accounts } = require("./tasks/account");

const MAINNET_DEPLOYER =
  process.env.MAINNET_DEPLOYER_OVERRIDE ||
  "0x29a8dF4d1c7a219679d197CF04C5FFD3Ecf56887";
// Mainnet decentralized OGV Governor
const MAINNET_GOVERNOR_FIVE = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
// Mainnet decentralized OGV Timelock
const MAINNET_TIMELOCK = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x72426ba137dec62657306b12b1e869d43fec6ec7";
// Multi-sig that controls the Governor. Aka "Guardian".
const MAINNET_MULTISIG = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
const MAINNET_STRATEGIST = "0xf14bbdf064e3f67f51cd9bd646ae3716ad938fdc";
const HOLESKY_DEPLOYER = "0x1b94CA50D3Ad9f8368851F8526132272d1a5028C";
const BASE_DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BASE_GOVERNOR = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});

let forkBlockNumber = adjustTheForkBlockNumber();

const paths = {};
if (isHolesky || isHoleskyForkTest || isHoleskyFork) {
  // holesky deployment files are in contracts/deploy/holesky
  paths.deploy = "deploy/holesky";
} else if (isBase || isBaseForkTest || isBaseFork) {
  // base deployment files are in contracts/deploy/base
  paths.deploy = "deploy/base";
} else {
  paths.deploy = "deploy/mainnet";
}

if (process.env.HARDHAT_CACHE_DIR) {
  paths.cache = process.env.HARDHAT_CACHE_DIR;
}
const { provider, chainId } = getHardhatNetworkProperties();

module.exports = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  tracer: {
    nameTags: {
      "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer Vault",
      "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b": "Uniswap Universal Router",
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId,
      ...(isArbitrumFork ? { tags: ["arbitrumOne"] } : {}),
      ...(isForkTest
        ? {
            timeout: 0,
            initialBaseFeePerGas: 0,
            forking: {
              enabled: true,
              url: provider,
              blockNumber: forkBlockNumber,
              timeout: 0,
            },
          }
        : {
            initialBaseFeePerGas: 0,
            gas: 7000000,
            gasPrice: 1000,
          }),
    },
    localhost: {
      timeout: 0,
      ...(isArbitrumFork
        ? { tags: ["arbitrumOne"] }
        : isBaseFork
        ? { tags: ["base"] }
        : {}),
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
    },
    holesky: {
      url: holeskyProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 17000,
      live: true,
    },
    arbitrumOne: {
      url: arbitrumProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 42161,
      tags: ["arbitrumOne"],
      live: true,
      saveDeployments: true,
      // Fails if gas limit is anything less than 20M on Arbitrum One
      gas: 20000000,
      // initialBaseFeePerGas: 0,
    },
    base: {
      url: baseProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 8453,
      tags: ["base"],
      live: true,
      saveDeployments: true,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
    timeout: parseInt(process.env.MOCHA_TIMEOUT) || 40000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : MAINNET_DEPLOYER
          : 0,
      hardhat:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : MAINNET_DEPLOYER
          : 0,
      mainnet: MAINNET_DEPLOYER,
      arbitrumOne: MAINNET_DEPLOYER,
      holesky: HOLESKY_DEPLOYER,
      base: BASE_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : isBaseFork
            ? BASE_GOVERNOR
            : MAINNET_GOVERNOR
          : 1,
      hardhat:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : isBaseFork
            ? BASE_GOVERNOR
            : MAINNET_GOVERNOR
          : 1,
      mainnet: MAINNET_GOVERNOR,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the governor
      base: BASE_GOVERNOR,
    },
    /* Local node environment currently has no access to Decentralized governance
     * address, since the contract is in another repo. Once we merge the ousd-governance
     * and this repo, it will be able to fetch the address from the deployed governance contract.
     *
     * Even then in local node environment the `governorFiveAddr` named account
     * is not to be used. Should only be used in forked and mainnet environments.
     */
    governorFiveAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? MAINNET_GOVERNOR_FIVE
          : ethers.constants.AddressZero,
      hardhat:
        process.env.FORK === "true"
          ? MAINNET_GOVERNOR_FIVE
          : ethers.constants.AddressZero,
      mainnet: MAINNET_GOVERNOR_FIVE,
    },
    // above governorFiveAddr comment applies to timelock as well
    timelockAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? MAINNET_TIMELOCK
          : ethers.constants.AddressZero,
      hardhat:
        process.env.FORK === "true"
          ? MAINNET_TIMELOCK
          : ethers.constants.AddressZero,
      mainnet: MAINNET_TIMELOCK,
      base: MAINNET_TIMELOCK, // TODO: change this
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
      localhost:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : MAINNET_STRATEGIST
          : 0,
      hardhat:
        process.env.FORK === "true"
          ? isHoleskyFork
            ? HOLESKY_DEPLOYER
            : MAINNET_STRATEGIST
          : 0,
      mainnet: MAINNET_STRATEGIST,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the strategist
      base: BASE_GOVERNOR,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: process.env.CONTRACT_SIZE ? true : false,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      holesky: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "holesky",
        chainId: 17000,
        urls: {
          apiURL: "https://api-holesky.etherscan.io/api",
          browserURL: "https://holesky.etherscan.io",
        },
      },
      {
        network: "base",
        chainId: 8543,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  paths,
};
