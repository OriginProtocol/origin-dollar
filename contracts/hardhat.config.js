const ethers = require("ethers");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
// require("solidity-coverage");
// require("buidler-gas-reporter");

const MAINNET_DEPLOYER = "0xAed9fDc9681D61edB5F8B8E421f5cEe8D7F4B04f";
const MAINNET_MULTISIG = "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

task(
  "mainnet_env_vars",
  "Check env vars are properly set for a Mainnet deployment",
  async () => {
    const envVars = ["PROVIDER_URL", "DEPLOYER_PK", "GOVERNOR_PK"];
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        throw new Error(
          `For Mainnet deploy env var ${envVar} must be defined.`
        );
      }
    }

    if (process.env.GAS_MULTIPLIER) {
      const value = Number(process.env.GAS_MULTIPLIER);
      if (value < 0 || value > 2) {
        throw new Error(`Check GAS_MULTIPLIER. Value out of range.`);
      }
    }
    console.log("All good. Deploy away!");
  }
);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(hre.network.name);
  if (isMainnetOrRinkeby) {
    privateKeys = [process.env.DEPLOYER_PK, process.env.GOVERNOR_PK];
  }

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress();
    console.log(address, privateKeys[i], role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`);
    }
    i++;
  }
});

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
      mnemonic,
    },
    rinkeby: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      mainnet: MAINNET_DEPLOYER,
      hardhat: 0,
    },
    governorAddr: {
      default: 1,
      mainnet: MAINNET_MULTISIG,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
    },
  },
  gasReporter: {
    currency: "USD",
    // outputFile: 'gasreport.out',
    enabled: Boolean(process.env.GAS_REPORT),
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
