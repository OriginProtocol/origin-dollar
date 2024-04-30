const addresses = require("../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "091_simplified_oeth_vault",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "115324645974339614256957686144083128142732871333625430716165228599583774495641",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Deploy VaultCore implementation
    await deployWithConfirmation("OETHVaultCore", [addresses.mainnet.WETH]);
    const dVaultImpl = await ethers.getContract("OETHVaultCore");

    const cOETHVault = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.OETHVaultProxy
    );

    return {
      name: "Simplified OETH mint and redeem\n\
    \n\
    Part of simplified OETH proposal. Makes redeem WETH-only (no more LST-mix redeem). \
    ",
      actions: [
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultImpl.address],
        },
        {
          contract: cOETHVault,
          signature: "cacheWETHAssetIndex()",
          args: [],
        },
      ],
    };
  }
);
