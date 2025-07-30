const ethers = require("ethers");
const { task } = require("hardhat/config");
const {
  isArbitrum,
  isArbitrumFork,
  isArbForkTest,
  isHoleskyFork,
  isHolesky,
  isForkTest,
  isHoleskyForkTest,
  isBase,
  isBaseFork,
  isBaseForkTest,
  isBaseUnitTest,
  isSonic,
  isSonicFork,
  isSonicForkTest,
  isSonicUnitTest,
  isPlume,
  isPlumeFork,
  isPlumeForkTest,
  isPlumeUnitTest,
  isHoodi,
  isHoodiFork,
  isHoodiForkTest,
  baseProviderUrl,
  sonicProviderUrl,
  arbitrumProviderUrl,
  holeskyProviderUrl,
  plumeProviderUrl,
  hoodiProviderUrl,
  adjustTheForkBlockNumber,
  getHardhatNetworkProperties,
} = require("./utils/hardhat-helpers.js");

require("@nomicfoundation/hardhat-verify");
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

const addresses = require("./utils/addresses.js");
const MAINNET_DEPLOYER =
  process.env.MAINNET_DEPLOYER_OVERRIDE ||
  "0x3Ba227D87c2A7aB89EAaCEFbeD9bfa0D15Ad249A";
// Mainnet decentralized OGV Governor
const MAINNET_GOVERNOR_FIVE = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
// Mainnet decentralized OGV Timelock
const MAINNET_TIMELOCK = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x72426ba137dec62657306b12b1e869d43fec6ec7";
// 5/8 multi-sig that controls the Governor. Aka "Admin".
const MAINNET_MULTISIG = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const MAINNET_STRATEGIST = "0xf14bbdf064e3f67f51cd9bd646ae3716ad938fdc";
const HOLESKY_DEPLOYER = "0x1b94CA50D3Ad9f8368851F8526132272d1a5028C";
const BASE_DEPLOYER = MAINNET_DEPLOYER;
// 5/8 multi-sig that controls the Timelock. Aka "Admin".
const BASE_GOVERNOR = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const BASE_STRATEGIST = "0x28bce2eE5775B652D92bB7c2891A89F036619703";
const SONIC_DEPLOYER = MAINNET_DEPLOYER;
// 5/8 multi-sig that controls the Timelock. Aka "Admin".
const SONIC_ADMIN = "0xAdDEA7933Db7d83855786EB43a238111C69B00b6";
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const SONIC_STRATEGIST = "0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a";

const MULTICHAIN_STRATEGIST = "0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971";

const PLUME_DEPLOYER = MAINNET_DEPLOYER;
// Plume 5/8 multisig
const PLUME_ADMIN = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
// Plume 2/8 multisig
const PLUME_STRATEGIST = MULTICHAIN_STRATEGIST;

const HOODI_DEPLOYER = MAINNET_DEPLOYER;
// Hoodi Relayer
const HOODI_RELAYER = "0x419B6BdAE482f41b8B194515749F3A2Da26d583b";

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
} else if (isBase || isBaseFork || isBaseForkTest || isBaseUnitTest) {
  paths.deploy = "deploy/base";
} else if (isSonic || isSonicFork || isSonicForkTest || isSonicUnitTest) {
  paths.deploy = "deploy/sonic";
} else if (isArbitrum || isArbitrumFork || isArbForkTest) {
  paths.deploy = "deploy/arbitrumOne";
} else if (isPlume || isPlumeFork || isPlumeForkTest || isPlumeUnitTest) {
  paths.deploy = "deploy/plume";
} else if (isHoodi || isHoodiFork || isHoodiForkTest) {
  paths.deploy = "deploy/hoodi";
} else {
  // holesky deployment files are in contracts/deploy/mainnet
  paths.deploy = "deploy/mainnet";
}
if (process.env.HARDHAT_CACHE_DIR) {
  paths.cache = process.env.HARDHAT_CACHE_DIR;
}
const { provider, chainId } = getHardhatNetworkProperties();

const defaultAccounts = [
  process.env.DEPLOYER_PK || privateKeys[0],
  process.env.GOVERNOR_PK || privateKeys[0],
];

const getDeployTags = () => {
  if (isArbitrumFork) {
    return ["arbitrumOne"];
  } else if (isBaseFork) {
    return ["base"];
  } else if (isSonicFork) {
    return ["sonic"];
  } else if (isPlumeFork) {
    return ["plume"];
  }

  return undefined;
};

/// Config for Fork and unit test environments
const localEnvDeployer =
  process.env.FORK === "true"
    ? isHoleskyFork
      ? HOLESKY_DEPLOYER
      : isBaseFork
      ? BASE_DEPLOYER
      : isSonicFork
      ? SONIC_DEPLOYER
      : isPlumeFork
      ? PLUME_DEPLOYER
      : isHoodiFork
      ? HOODI_DEPLOYER
      : MAINNET_DEPLOYER
    : 0; // 0th signer fallback

const localEnvGovernor =
  process.env.FORK === "true"
    ? isHoleskyFork
      ? HOLESKY_DEPLOYER
      : isBaseFork
      ? BASE_GOVERNOR
      : isSonicFork
      ? SONIC_ADMIN
      : isPlumeFork
      ? PLUME_ADMIN
      : isHoodiFork
      ? HOODI_RELAYER
      : MAINNET_GOVERNOR
    : 1; // signer at index 1

const localEnvTimelock =
  process.env.FORK_NETWORK_NAME == "base"
    ? addresses.base.timelock
    : process.env.FORK_NETWORK_NAME == "sonic"
    ? addresses.sonic.timelock
    : process.env.FORK_NETWORK_NAME == "plume"
    ? addresses.plume.timelock
    : process.env.FORK_NETWORK_NAME == "mainnet" ||
      (!process.env.FORK_NETWORK_NAME && process.env.FORK == "true")
    ? MAINNET_TIMELOCK
    : ethers.constants.AddressZero;

const localEnvStrategist =
  process.env.FORK === "true"
    ? isHoleskyFork
      ? HOLESKY_DEPLOYER
      : isSonicFork
      ? SONIC_STRATEGIST
      : // Base, Plume and Eth use Multichain Strategist
      isHoodiFork
      ? HOODI_RELAYER
      : MULTICHAIN_STRATEGIST
    : 0;

module.exports = {
  solidity: {
    version: "0.8.28",
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
      blockGasLimit: 1000000000,
      allowUnlimitedContractSize: true,
      chainId,
      tags: getDeployTags(),
      ...(isForkTest
        ? {
            timeout: 0,
            initialBaseFeePerGas: 0,
            forking: {
              enabled: true,
              url: provider,
              blockNumber: forkBlockNumber
                ? parseInt(forkBlockNumber)
                : undefined,
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
      tags: getDeployTags(),
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: defaultAccounts,
    },
    holesky: {
      url: holeskyProviderUrl,
      accounts: defaultAccounts,
      chainId: 17000,
      live: true,
    },
    arbitrumOne: {
      url: arbitrumProviderUrl,
      accounts: defaultAccounts,
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
      accounts: defaultAccounts,
      chainId: 8453,
      tags: ["base"],
      live: true,
      saveDeployments: true,
    },
    sonic: {
      url: sonicProviderUrl,
      accounts: defaultAccounts,
      chainId: 146,
      tags: ["sonic"],
      live: true,
      saveDeployments: true,
    },
    plume: {
      url: plumeProviderUrl,
      accounts: defaultAccounts,
      chainId: 98866,
      tags: ["plume"],
      live: true,
      saveDeployments: true,
    },
    hoodi: {
      url: hoodiProviderUrl,
      accounts: defaultAccounts,
      chainId: 560048,
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
      localhost: localEnvDeployer,
      hardhat: localEnvDeployer,
      mainnet: MAINNET_DEPLOYER,
      arbitrumOne: MAINNET_DEPLOYER,
      holesky: HOLESKY_DEPLOYER,
      base: BASE_DEPLOYER,
      sonic: SONIC_DEPLOYER,
      plume: MAINNET_DEPLOYER,
      hoodi: HOODI_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: localEnvGovernor,
      hardhat: localEnvGovernor,
      mainnet: MAINNET_GOVERNOR,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the governor
      base: BASE_GOVERNOR,
      sonic: SONIC_ADMIN,
      plume: PLUME_ADMIN,
      hoodi: HOODI_RELAYER,
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
    // Above governorFiveAddr comment applies to governorSix as well
    governorSixAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? addresses.mainnet.GovernorSix
          : ethers.constants.AddressZero,
      hardhat:
        process.env.FORK === "true"
          ? addresses.mainnet.GovernorSix
          : ethers.constants.AddressZero,
      mainnet: addresses.mainnet.GovernorSix,
    },
    // Above governorFiveAddr comment applies to timelock as well
    timelockAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: localEnvTimelock,
      hardhat: localEnvTimelock,
      mainnet: MAINNET_TIMELOCK,
      base: addresses.base.timelock,
      sonic: addresses.sonic.timelock,
      plume: addresses.plume.timelock,
    },
    guardianAddr: {
      default: 1,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: localEnvGovernor,
      hardhat: localEnvGovernor,
      mainnet: MAINNET_MULTISIG,
      base: BASE_GOVERNOR,
      sonic: SONIC_ADMIN,
      plume: PLUME_STRATEGIST,
      hoodi: HOODI_RELAYER,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
    },
    strategistAddr: {
      default: 0,
      localhost: localEnvStrategist,
      hardhat: localEnvStrategist,
      mainnet: MULTICHAIN_STRATEGIST,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the strategist
      base: MULTICHAIN_STRATEGIST,
      sonic: SONIC_STRATEGIST,
      plume: PLUME_STRATEGIST,
      hoodi: HOODI_RELAYER,
    },
    multichainStrategistAddr: {
      default: MULTICHAIN_STRATEGIST,
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
      sonic: process.env.SONICSCAN_API_KEY,
      hoodi: process.env.HOODISCAN_API_KEY,
      plume: "empty", // this works for: npx hardhat verify...
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
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
      {
        network: "plume",
        chainId: 98866,
        urls: {
          apiURL: "https://explorer.plume.org/api",
          browserURL: "https://explorer.plume.org",
        },
      },
      {
        network: "hoodi",
        chainId: 560048,
        urls: {
          apiURL: "https://hoodi.etherscan.io/api",
          browserURL: "https://hoodi.etherscan.io",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    reportPureAndViewMethods: true,
  },
  sourcify: {
    enabled: true,
  },
  paths,
};
