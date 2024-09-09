const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "013_harvester",
    useTimelock: true
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cAMOStrategyProxy = await ethers.getContract("AerodromeAMOStrategyProxy");

    // Deploy proxy
    await deployWithConfirmation("OETHBaseHarvesterProxy");
    const cHarvesterProxy = await ethers.getContract(
      "OETHBaseHarvesterProxy"
    );

    // Deploy implementation
    const dHarvesterImpl = await deployWithConfirmation("OETHBaseHarvester", [
      cOETHbVaultProxy.address,
      cAMOStrategyProxy.address,
      addresses.base.AERO
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

    return {
      actions: [
        {
          // 1. Set as harvester address on the strategy
          contract: cAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        }
      ],
    };
  }
);
