usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("@nomiclabs/buidler-ganache");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

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
      fork: "https://mainnet.infura.io/v3/988930c507b9488a82849f5d16c0ca13",
      network_id: 999,
      logger: console,
      mnemonic,
    },
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
    },
    governorAddr: {
      default: 1,
    },
    proxyAdminAddr: {
      default: 1,
    },
  },
};
