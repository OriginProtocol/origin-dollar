const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const {
  deployOETHSupernovaAMOStrategyImplementation,
  deployOETHSupernovaAMOStrategyPoolAndGauge,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "178_supernova_AMO",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cOETHVaultProxy.address
    );

    // TODO: delete once the pools and gauges are created
    const { poolAddress, gaugeAddress } =
      await deployOETHSupernovaAMOStrategyPoolAndGauge();

    await deployWithConfirmation("OETHSupernovaAMOProxy");
    const cOETHSupernovaAMOProxy = await ethers.getContract(
      "OETHSupernovaAMOProxy"
    );
    console.log("poolAddress", poolAddress);
    console.log("gaugeAddress", gaugeAddress);

    // Deploy Sonic SwapX AMO Strategy implementation
    const cSupernovaAMOStrategy =
      await deployOETHSupernovaAMOStrategyImplementation(
        poolAddress,
        gaugeAddress
      );

    return {
      name: "Deploy Supernova AMO Strategy",
      actions: [
        // 1. Approve new strategy on the Vault
        {
          contract: cOETHVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOETHSupernovaAMOProxy.address],
        },
        // 2. Add strategy to mint whitelist
        {
          contract: cOETHVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHSupernovaAMOProxy.address],
        },
        // 3. Set the Harvester on the Supernova AMO strategy
        {
          contract: cSupernovaAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainBuybackOperator],
        },
      ],
    };
  }
);
