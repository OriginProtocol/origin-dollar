const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "089_simplified_oeth_vault",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId: "",
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
    Part of simplified OETH proposal. Trims down mint and redeem complexity on OETH Vault. Set redeem fees to zero. \
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
