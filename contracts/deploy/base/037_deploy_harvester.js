const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy");
const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  {
    deployName: "037_deploy_harvester",
  },
  async ({ ethers, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    await deployWithConfirmation("OETHBaseHarvesterProxy");
    const cHarvesterProxy = await ethers.getContract("OETHBaseHarvesterProxy");
    const cAerodromeAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAerodromeAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAerodromeAMOStrategyProxy.address
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

    const initData = cHarvester.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // prettier-ignore
    await withConfirmation(
        cHarvesterProxy
            .connect(sDeployer)["initialize(address,address,bytes)"](
                dHarvester.address,
                addresses.base.timelock,
                initData
            )
    );
    console.log("Initialized OETHBaseHarvesterProxy");

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    return {
      actions: [
        {
          // Set Vault as Dripper
          contract: cHarvester,
          signature: "setDripper(address)",
          args: [cOETHbVaultProxy.address],
        },
        {
          // Set Multi-chain Guardian as Strategist
          contract: cHarvester,
          signature: "setStrategistAddr(address)",
          args: [addresses.base.multichainStrategist],
        },
        {
          // Mark Aerodome AMO strategy as supported
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAerodromeAMOStrategyProxy.address, true],
        },
        {
          // Mark Curve AMO strategy as supported
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cCurveAMOStrategyProxy.address, true],
        },
        {
          // Set the harvester address on the Aerodrome AMO strategy
          contract: cAerodromeAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
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
