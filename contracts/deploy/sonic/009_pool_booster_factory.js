const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "009_pool_booster_factory",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const dPoolBoosterFactory = await deployWithConfirmation(
      "PoolBoosterFactorySwapxIchi_v1",
      [addresses.sonic.OSonicProxy, addresses.sonic.timelock],
      "PoolBoosterFactorySwapxIchi"
    );
    const cPoolBoosterFactory = await ethers.getContract(
      "PoolBoosterFactorySwapxIchi_v1"
    );
    console.log(
      `Pool Booster Ichi Factory deployed to ${dPoolBoosterFactory.address}`
    );

    await deployWithConfirmation("PoolBoostCentralRegistryProxy", []);
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
          addresses.sonic.timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    return {
      actions: [
        {
          contract: cPoolBoosterFactory,
          signature:
            "createPoolBoosterSwapxIchi(address,address,address,uint256,uint256)",
          args: [
            addresses.sonic.SwapXOsUSDCe.extBribeOS,
            addresses.sonic.SwapXOsUSDCe.extBribeUSDC,
            addresses.sonic.SwapXOsUSDCe.pool,
            oethUnits("0.7"), // 70%
            ethers.BigNumber.from(`${Date.now()}`), // current time as salt
          ],
        },
        {
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          // TODO: manually adjust the address of the deployed factory once the deployment
          // script is ran and the factory address is known.
          args: [addresses.dead],
        },
      ],
    };
  }
);
