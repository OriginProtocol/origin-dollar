const addresses = require("../../utils/addresses.js");
const { deployOnSonic } = require("../../utils/deploy-l2.js");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "009_harvester",
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();

    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    await deployWithConfirmation("OSonicHarvesterProxy");

    await deployWithConfirmation("OETHHarvesterSimple", [addresses.sonic.wS]);
    const dHarvester = await ethers.getContract("OETHHarvesterSimple");

    const cHarvesterProxy = await ethers.getContract("OSonicHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cHarvesterProxy.address
    );

    const cDripperProxy = await ethers.getContract("OSonicDripperProxy");

    // const cStakingStrategyProxy = await ethers.getContract("SonicStakingStrategyProxy");

    const initSonicStakingStrategy = cHarvester.interface.encodeFunctionData(
      "initialize(address,address,address)",
      [addresses.sonic.timelock, strategistAddr, cDripperProxy.address]
    );

    // prettier-ignore
    await withConfirmation(
      cHarvesterProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dHarvester.address,
          addresses.sonic.timelock,
          initSonicStakingStrategy
        )
    );

    return {
      actions: [
        // TODO: Enable for Curve AMO after it has been deployed
        // {
        //   contract: cHarvesterProxy,
        //   signature: "setSupportedStrategy(address,bool)",
        //   args: [cStakingStrategyProxy.address, true],
        // },
      ],
    };
  }
);