const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "005_bridged_woeth_strategy",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    // Deploy proxy
    await deployWithConfirmation("BridgedWOETHStrategyProxy");
    const cStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    // Deploy implementation
    const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
      [addresses.zero, cOETHbVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      addresses.base.BridgedWOETHOracleFeed,
    ]);
    const cStrategy = await ethers.getContractAt(
      "BridgedWOETHStrategy",
      cStrategyProxy.address
    );

    // Init OETHb Harvester
    const initData = cStrategy.interface.encodeFunctionData("initialize()", []);
    // prettier-ignore
    await withConfirmation(
      cStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dStrategyImpl.address,
          governorAddr,
          initData
        )
    );
    console.log("Initialized BridgedWOETHStrategyProxy");

    return {
      actions: [
        {
          // 1. Approve strategy
          contract: cOETHbVault,
          signature: "approveStrategy(address)",
          args: [cStrategyProxy.address],
        },
        {
          // 2. Add to mint whitelist
          contract: cOETHbVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
