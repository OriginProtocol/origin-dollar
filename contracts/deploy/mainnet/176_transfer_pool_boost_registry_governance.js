const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "176_transfer_pool_boost_registry_governance",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "82732039039728467243283754654134444302286420496150398783369816761252174679817",
  },
  async () => {
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    return {
      name: "Transfer PoolBoostCentralRegistry governance to strategist",
      actions: [
        {
          contract: cPoolBoostCentralRegistry,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
