const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy");
const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  {
    deployName: "026_harvester_v2",
  },
  async ({ ethers }) => {
    const cHarvesterProxy = await ethers.getContract("OETHBaseHarvesterProxy");
    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cCurveAMOStrategyProxy = await ethers.getContract(
      "OETHBaseCurveAMOProxy"
    );
    const cCurveAMOStrategy = await ethers.getContractAt(
      "BaseCurveAMOStrategy",
      cCurveAMOStrategyProxy.address
    );

    const dHarvester = await deployWithConfirmation("SuperOETHHarvester", [
      addresses.base.WETH,
    ]);
    console.log("SuperOETHHarvester deployed at", dHarvester.address);

    const cHarvester = await ethers.getContractAt(
      "SuperOETHHarvester",
      cHarvesterProxy.address
    );

    const cDripperProxy = await ethers.getContract("OETHBaseDripperProxy");

    return {
      actions: [
        {
          // Upgrade the harvester
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvester.address],
        },
        {
          // Upgrade the harvester
          contract: cHarvester,
          signature: "initialize(address,address,address)",
          args: [
            addresses.base.timelock,
            addresses.multichainStrategist,
            cDripperProxy.address,
          ],
        },
        {
          // Mark Aerodome AMO strategy as supported
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAMOStrategyProxy.address, true],
        },
        {
          // Mark Curve AMO strategy as supported
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cCurveAMOStrategyProxy.address, true],
        },
        {
          // Set the harvester address on the Curve AMO strategy
          contract: cCurveAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
