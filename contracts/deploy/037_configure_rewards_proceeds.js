const { deploymentWithProposal, log } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "037_configure_rewards_proceeds", forceDeploy: false },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");

    // Deployer Actions
    // ----------------

    // Deploy new Harvester proxy
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");

    const dHarvesterImpl = await deployWithConfirmation("Harvester", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);

    const dHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Switch to multiple rewards token strategies for all strategies",
      actions: [
        // 1. Set harvester implementation
        {
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvesterImpl.address],
        },
        // 2. Set vault as rewards address
        {
          contract: dHarvester,
          signature: "setRewardsProceedsAddress(address)",
          args: [cVaultProxy.address],
        },
      ],
    };
  }
);
