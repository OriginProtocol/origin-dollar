const addresses = require("../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "085_upgrade_oeth_vault",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "72116514921051679346398237778682113450913991391551128830137727748559915078301",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Deploy VaultCore implementation
    await deployWithConfirmation("OETHVaultCore", [addresses.mainnet.WETH]);
    const dVaultImpl = await ethers.getContract("OETHVaultCore");

    return {
      name: "Disable minting OETH with LSTs\n\
    \n\
    The first step of simplifying OETH. This disables minting OETH with all supported LSTs. OETH can only be minted with WETH using the Vault and with ETH using the Zapper contract. \
    ",
      actions: [
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultImpl.address],
        },
      ],
    };
  }
);
