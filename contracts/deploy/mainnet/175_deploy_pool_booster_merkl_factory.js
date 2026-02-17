const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "175_deploy_pool_booster_merkl_factory",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // Get old factory from deployment artifacts
    const oldFactory = await ethers.getContract("PoolBoosterFactoryMerkl");

    // ---------------------------------------------------------------------------------------------------------
    // --- 1. Deploy PoolBoosterMerklV2 (implementation for beacon proxies)
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterMerklV2 = await deployWithConfirmation(
      "PoolBoosterMerklV2",
      []
    );
    console.log(
      `PoolBoosterMerklV2 deployed to ${dPoolBoosterMerklV2.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 2. Deploy UpgradeableBeacon pointing to PoolBoosterMerklV2
    // ---------------------------------------------------------------------------------------------------------
    const dUpgradeableBeacon = await deployWithConfirmation(
      "UpgradeableBeacon",
      [dPoolBoosterMerklV2.address]
    );
    // Transfer beacon ownership from deployer to multichainStrategist
    const cBeacon = await ethers.getContractAt(
      "UpgradeableBeacon",
      dUpgradeableBeacon.address
    );
    const { deployerAddr: beaconDeployerAddr } = await getNamedAccounts();
    const sBeaconDeployer = ethers.provider.getSigner(beaconDeployerAddr);
    await cBeacon
      .connect(sBeaconDeployer)
      .transferOwnership(addresses.multichainStrategist);
    console.log(`UpgradeableBeacon deployed to ${dUpgradeableBeacon.address}`);

    // ---------------------------------------------------------------------------------------------------------
    // --- 3. Deploy PoolBoosterFactoryMerklProxy
    // ---------------------------------------------------------------------------------------------------------
    const dFactoryProxy = await deployWithConfirmation(
      "PoolBoosterFactoryMerklProxy",
      []
    );
    console.log(
      `PoolBoosterFactoryMerklProxy deployed to ${dFactoryProxy.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 4. Deploy PoolBoosterFactoryMerkl implementation (new initializable version)
    // ---------------------------------------------------------------------------------------------------------
    const dFactoryImpl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [],
      undefined,
      true
    );
    console.log(
      `PoolBoosterFactoryMerkl impl deployed to ${dFactoryImpl.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 5. Initialize factory proxy
    // ---------------------------------------------------------------------------------------------------------
    const iFactory = new ethers.utils.Interface([
      "function initialize(address,address,address)",
    ]);
    const factoryInitData = iFactory.encodeFunctionData("initialize", [
      addresses.multichainStrategist,
      cPoolBoostCentralRegistryProxy.address,
      dUpgradeableBeacon.address,
    ]);

    const cFactoryProxy = await ethers.getContractAt(
      "PoolBoosterFactoryMerklProxy",
      dFactoryProxy.address
    );
    // The deployer initializes the proxy (sets impl + governor + calls initialize)
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = ethers.provider.getSigner(deployerAddr);
    const initProxy = cFactoryProxy.connect(sDeployer);
    await initProxy["initialize(address,address,bytes)"](
      dFactoryImpl.address,
      addresses.multichainStrategist,
      factoryInitData
    );
    console.log("Factory proxy initialized");

    // ---------------------------------------------------------------------------------------------------------
    // --- 6. Governance proposal
    // ---------------------------------------------------------------------------------------------------------
    return {
      name: "Swap PoolBoosterFactoryMerkl",
      actions: [
        {
          // Remove old factory from central registry
          contract: cPoolBoostCentralRegistry,
          signature: "removeFactory(address)",
          args: [oldFactory.address],
        },
        {
          // Approve new factory proxy in central registry
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dFactoryProxy.address],
        },
      ],
    };
  }
);
