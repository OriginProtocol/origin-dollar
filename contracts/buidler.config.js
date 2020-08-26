const ethers = require("ethers");
const addresses = require("./utils/addresses");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");
usePlugin("solidity-coverage");

const fork =
  "https://eth-mainnet.alchemyapi.io/v2/cweL7vuMCrHRZhi4rO227veLANNkWBEo";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

const privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

task("accounts", "Prints the list of accounts", async (taskArguments, bre) => {
  const accounts = await bre.ethers.getSigners();

  const roles = ["Deployer", "Proxy Admin", "Governor"];

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    console.log(await account.getAddress(), privateKeys[i], role);
    i++;
  }
});

// Convert mnemonic into private keys for buidlerevm network config
module.exports = {
  solc: {
    version: "0.5.17",
  },
  networks: {
    buidlerevm: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
      accounts: privateKeys.map((privateKey) => {
        return {
          privateKey,
          balance: "10000000000000000000000",
        };
      }),
    },
    ganache: {
      url: "http://localhost:7546",
      fork,
      accounts: {
        mnemonic,
      },
      unlocked_accounts: [addresses.mainnet.Binance],
      // logger: console,
      // verbose: true,
    },
    coverage: {
      url: "http://localhost:8555",
    },
  },
  mocha: {
    // bail: true,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
    },
    proxyAdminAddr: {
      default: 1,
    },
    governorAddr: {
      default: 2,
    },
  },
};
