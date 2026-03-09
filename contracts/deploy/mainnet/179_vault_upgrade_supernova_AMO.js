const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const {
  deployOETHSupernovaAMOStrategyImplementation,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "179_vault_upgrade_supernova_AMO",
  },
  async ({ ethers }) => {
    // 1. Deploy new OETH Vault Core and Admin implementations
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVault",
      [addresses.mainnet.WETH],
      undefined,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // 3. Connect to the Compounding Staking Strategy Proxy to set it as default strategy
    const defaultStrategy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );

    // 4. Deploy Supernova AMO Strategy implementation
    await deployWithConfirmation("OETHSupernovaAMOProxy");
    const cOETHSupernovaAMOProxy = await ethers.getContract(
      "OETHSupernovaAMOProxy"
    );

    // Deploy Supernova AMO Strategy implementation
    const cSupernovaAMOStrategy =
      await deployOETHSupernovaAMOStrategyImplementation();

    return {
      name: "Upgrade OETH Vault to new Core and Admin implementations and deploy Supernova AMO Strategy",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultAdmin.address],
        },
        // 2. Set Compounding Staking Strategy as default strategy
        {
          contract: cVault,
          signature: "setDefaultStrategy(address)",
          args: [defaultStrategy.address],
        },
        // 3. Approve new strategy on the Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cOETHSupernovaAMOProxy.address],
        },
        // 4. Add strategy to mint whitelist
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHSupernovaAMOProxy.address],
        },
        // 5. Set the Harvester on the Supernova AMO strategy
        {
          contract: cSupernovaAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
