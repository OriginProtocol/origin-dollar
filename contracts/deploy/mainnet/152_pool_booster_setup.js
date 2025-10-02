const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "152_pool_booster_setup",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const oethProxy = await ethers.getContract("OETHProxy");
    const oeth = await ethers.getContractAt("OETH", oethProxy.address);

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoostCentralRegistry
    // ---
    // ---------------------------------------------------------------------------------------------------------

    await deployWithConfirmation("PoolBoostCentralRegistryProxy");
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    console.log(
      `Pool boost central registry proxy deployed: ${cPoolBoostCentralRegistryProxy.address}`
    );

    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );
    console.log(
      `Deployed Pool Boost Central Registry to ${dPoolBoostCentralRegistry.address}`
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // prettier-ignore
    await withConfirmation(
      cPoolBoostCentralRegistryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoostCentralRegistry.address,
          addresses.mainnet.Timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterFactoryMerkl
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterFactoryMerkl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [
        oeth.address,
        // so we can create a Merkl pool booster fast via a multichain strategist and kick off yield forwarding
        addresses.multichainStrategist,
        cPoolBoostCentralRegistryProxy.address,
        addresses.mainnet.MerklDistributor,
      ]
    );
    const cPoolBoosterMerklFactory = await ethers.getContract(
      "PoolBoosterFactoryMerkl"
    );

    console.log(
      `Pool Booster Merkl Factory deployed to ${cPoolBoosterMerklFactory.address}`
    );

    return {
      name: "Upgrade PoolBoosterCentralRegistry and deploy PoolBoosterFactoryMerkl",
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactoryMerkl.address],
        },
      ],
    };
  }
);
