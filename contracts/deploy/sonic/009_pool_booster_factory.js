const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "009_pool_booster_factory",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const dPoolBoosterFactoryProxy = await deployWithConfirmation(
      "PoolBoosterFactoryProxy"
    );
    console.log(
      `Deployed Pool Booster Factory proxy to ${dPoolBoosterFactoryProxy.address}`
    );

    const cPoolBoosterFactoryProxy = await ethers.getContract(
      "PoolBoosterFactoryProxy"
    );
    const dPoolBoosterFactory = await deployWithConfirmation(
      "PoolBoosterFactory",
      [addresses.sonic.OSonicProxy]
    );
    console.log(
      `Deployed Pool Booster Factory to ${dPoolBoosterFactory.address}`
    );
    const cPoolBoosterFactory = await ethers.getContractAt(
      "PoolBoosterFactory",
      cPoolBoosterFactoryProxy.address
    );

    // Init the Pool Booster Factory
    const initPoolBoosterFactory =
      cPoolBoosterFactory.interface.encodeFunctionData("initialize(address,address)", [
        addresses.sonic.timelock,
        addresses.sonic.guardian
      ]);

    // prettier-ignore
    await withConfirmation(
      cPoolBoosterFactoryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoosterFactory.address,
          addresses.sonic.timelock,
          initPoolBoosterFactory
        )
    );
    console.log("Initialized PoolBoosterFactory proxy and implementation");

    return {
      actions: [

      ],
    };
  }
);
