const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "139_deprecate_ousd_harvester",
    forceDeploy: false,
    forceSkip: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    const cMetaMorphoStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );
    const cMetaMorphoStrategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      cMetaMorphoStrategyProxy.address
    );

    const cMorphoGauntletPrimeUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const cMorphoGauntletPrimeUSDCStrategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      cMorphoGauntletPrimeUSDCStrategyProxy.address
    );

    const cMorphoGauntletPrimeUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cMorphoGauntletPrimeUSDTStrategy = await ethers.getContractAt(
      "Generalized4626USDTStrategy",
      cMorphoGauntletPrimeUSDTStrategyProxy.address
    );

    return {
      name: `Deprecate OUSD Harvester
- Makes the multichain Gaurdian the harvester for OUSD strategies.
- Transfers governance of harvester contract to the multichain strategist to move out funds.`,
      actions: [
        {
          contract: cMetaMorphoStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cMorphoGauntletPrimeUSDCStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cMorphoGauntletPrimeUSDTStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cHarvester,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
