const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../test/helpers");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "022_upgrade_woeth_strategy",
  },
  async ({ deployWithConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();

    if (isFork) {
      await impersonateAndFund(deployerAddr);
    }

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    const cL2HandlerProxy = await ethers.getContract(
      "DirectStakingBaseHandlerProxy"
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy proxy and implementation contract
    await deployWithConfirmation("DirectStakingBaseHandlerProxy");
    const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
      [addresses.zero, cOETHbVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      cOETHbProxy.address,
      cL2HandlerProxy.address,
    ]);
    console.log("Deployed BridgedWOETHStrategy", dStrategyImpl.address);

    // const cStrategy = await ethers.getContractAt(
    //   "BridgedWOETHStrategy",
    //   cStrategyProxy.address
    // );

    return {
      actions: [
        {
          contract: cStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dStrategyImpl.address],
        },
      ],
    };
  }
);
