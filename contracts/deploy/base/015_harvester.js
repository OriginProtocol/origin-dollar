const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "015_harvester",
    useTimelock: true,
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );

    // Deploy proxy
    await deployWithConfirmation("OETHBaseHarvesterProxy");
    const cHarvesterProxy = await ethers.getContract("OETHBaseHarvesterProxy");

    // Deploy implementation
    const dHarvesterImpl = await deployWithConfirmation("OETHBaseHarvester", [
      cOETHbVaultProxy.address,
      cAMOStrategyProxy.address,
      addresses.base.AERO,
      addresses.base.WETH,
      addresses.base.swapRouter,
    ]);

    const cAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAMOStrategyProxy.address
    );

    // prettier-ignore
    await withConfirmation(
      cHarvesterProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dHarvesterImpl.address,
          addresses.base.timelock,
          "0x"
        )
    );
    console.log("Initialized OETHBaseHarvesterProxy");

    const cHarvester = await ethers.getContractAt(
      "OETHBaseHarvester",
      cHarvesterProxy.address
    );

    return {
      actions: [
        {
          // 1. Set as harvester address on the strategy
          contract: cAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // 2. Set Operator address
          contract: cHarvester,
          signature: "setOperatorAddr(address)",
          args: [addresses.base.OZRelayerAddress],
        },
      ],
    };
  }
);
