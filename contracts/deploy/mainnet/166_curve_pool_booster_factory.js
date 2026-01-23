const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  encodeSaltForCreateX,
} = require("../../utils/deploy");

const createxAbi = require("../../abi/createx.json");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "166_curve_pool_booster_factory",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
    console.log(`Deployer address: ${deployerAddr}`);
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Upgrade PoolBoostCentralRegistry
    // ---
    // ---------------------------------------------------------------------------------------------------------
    // Fetch current PoolBoostCentralRegistryProxy
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    // Deploy new PoolBoostCentralRegistry implementation
    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    console.log(
      `Deployed Pool Boost Central Registry implementation to ${dPoolBoostCentralRegistry.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy CurvePoolBoosterFactory
    // ---
    // ---------------------------------------------------------------------------------------------------------

    // This salt is constructed in a way where CreateX contract will recompute / guard the salt with the deployer address
    // as the message sender matches the initial part of the salt. This ensures that no other address can front-run our
    // factory deployment on another chain.
    // Salt incremented from 1 to 2 for the new factory deployment
    const factoryEncodedSalt = encodeSaltForCreateX(deployerAddr, false, 2);
    const txResponse = await withConfirmation(
      cCreateX
        .connect(sDeployer)
        .deployCreate2(factoryEncodedSalt, getFactoryBytecode())
    );

    const contractCreationTopic =
      "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";
    const txReceipt = await txResponse.wait();
    const implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events
        .find((event) => event.topics[0] === contractCreationTopic)
        .topics[1].slice(26)}`
    );
    const cCurvePoolBoosterFactory = await ethers.getContractAt(
      "CurvePoolBoosterFactory",
      implementationAddress
    );

    await cCurvePoolBoosterFactory.initialize(
      addresses.mainnet.Timelock,
      addresses.multichainStrategist,
      cPoolBoostCentralRegistry.address
    );

    console.log(
      `Pool Booster Factory deployed to ${cCurvePoolBoosterFactory.address}`
    );

    return {
      name: "Upgrade PoolBoosterCentralRegistry to support CurvePoolBoosterFactory",
      actions: [
        {
          contract: cPoolBoostCentralRegistryProxy,
          signature: "upgradeTo(address)",
          args: [dPoolBoostCentralRegistry.address],
        },
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [cCurvePoolBoosterFactory.address],
        },
      ],
    };
  }
);

async function getFactoryBytecode() {
  // No deployment needed—get factory directly from artifacts
  const factory = await ethers.getContractFactory("CurvePoolBoosterFactory");
  return factory.bytecode;
}
