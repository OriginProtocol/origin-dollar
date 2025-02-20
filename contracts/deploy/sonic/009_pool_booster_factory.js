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

    const cOSonic = await ethers.getContractAt("OSonic", addresses.sonic.OSonicProxy);

    const dPoolBoosterFactory = await deployWithConfirmation(
      "PoolBoosterFactorySwapxDouble_v1",
      [addresses.sonic.OSonicProxy, addresses.sonic.timelock],
      "PoolBoosterFactorySwapxDouble"
    );
    const cPoolBoosterFactory = await ethers.getContract(
      "PoolBoosterFactorySwapxDouble_v1"
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

    // TODO: we really need to get a handle on the generated address
    const deployedPoolBoosterAddress = addresses.dead;
    return {
      actions: [
        {
          contract: cPoolBoosterFactory,
          signature:
            "createPoolBoosterSwapxDouble(address,address,address,uint256,uint256)",
          args: [
            addresses.sonic.SwapXOsUSDCe.extBribeOS,
            addresses.sonic.SwapXOsUSDCe.extBribeUSDC,
            addresses.sonic.SwapXOsUSDCe.pool,
            oethUnits("0.7"), // 70%
            ethers.BigNumber.from("1740052983"), // epoch as Thu, 20 Feb 2025 12:03:03 GMT
          ],
        },
        {
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactory.address],
        },
        {
          // Undelegate yield from the OS/USDC.e pool
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: [
            addresses.sonic.SwapXOsUSDCe.pool
          ],
        },
        {
          // Delegate yield from the OS/USDC.e pool
          // to the pool booster
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            addresses.sonic.SwapXOsUSDCe.pool,
            deployedPoolBoosterAddress
          ],
        }
      ],
    };
  }
);
