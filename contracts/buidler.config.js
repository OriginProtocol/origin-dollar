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

module.exports = {
  solc: {
    version: "0.5.17",
  },
  networks: {
    buidlerevm: {
      allowUnlimitedContractSize: true
    },
    fork: {
      url: "http://127.0.0.1:7545",
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
