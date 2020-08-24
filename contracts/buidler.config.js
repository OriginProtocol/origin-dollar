const addresses = require("./utils/addresses");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

const fork = "https://mainnet.infura.io/v3/988930c507b9488a82849f5d16c0ca13";
// const fork = "https://eth-mainnet.alchemyapi.io/v2/cweL7vuMCrHRZhi4rO227veLANNkWBEo";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

module.exports = {
  solc: {
    version: "0.5.17",
  },
  networks: {
    buidlerevm: {
      allowUnlimitedContractSize: true,
    },
    ganache: {
      url: "http://localhost:7546",
      fork,
      mnemonic,
      unlocked_accounts: [addresses.mainnet.Binance],
      // logger: console,
      // verbose: true,
    },
  },
  mocha: {
    bail: true,
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
