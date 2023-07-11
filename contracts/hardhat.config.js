const ethers = require("ethers");
const { task } = require("hardhat/config");

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

const isForkTest =
  process.env.FORK === "true" && process.env.IS_TEST === "true";

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
      ...(isForkTest
        ? {
            chainId: 1,
            timeout: 0,
            forking: {
              enabled: true,
              url: `${
                process.env.LOCAL_PROVIDER_URL || process.env.PROVIDER_URL
              }`,
              blockNumber: Number(process.env.FORK_BLOCK_NUMBER) || undefined,
              timeout: 0,
            },
          }
        : {
            chainId: 1337,
            initialBaseFeePerGas: 0,
            gas: 7000000,
            gasPrice: 1000,
            ...(process.env.FORKED_LOCAL_TEST
              ? {
                  timeout: 0,
                  forking: {
                    enabled: true,
                    url: `${
                      process.env.LOCAL_PROVIDER_URL || process.env.PROVIDER_URL
                    }`,
                    blockNumber:
                      Number(process.env.FORK_BLOCK_NUMBER) || undefined,
                    timeout: 0,
                  },
                }
              : {}),
          }),
    },
    localhost: {
      timeout: 0,
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
    timeout: parseInt(process.env.MOCHA_TIMEOUT) || 40000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_DEPLOYER : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_DEPLOYER : 0,
      mainnet: MAINNET_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: process.env.FORK === "true" ? MAINNET_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? MAINNET_GOVERNOR : 1,
      mainnet: MAINNET_GOVERNOR,
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
    runOnCompile: process.env.CONTRACT_SIZE ? true : false,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  paths: process.env.HARDHAT_CACHE_DIR
    ? {
        cache: process.env.HARDHAT_CACHE_DIR,
      }
    : {},
};
