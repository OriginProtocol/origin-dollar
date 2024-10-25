const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "021_direct_staking",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy contract
    const dL2Handler = await deployWithConfirmation("DirectStakingHandlerL2", [
      addresses.base.ccipRouter,
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
    ]);
    console.log("Deployed DirectStakingHandlerL2", dL2Handler.address);

    const { deployerAddr } = await getNamedAccounts();
    await impersonateAndFund(deployerAddr);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cL2Handler = await ethers.getContract("DirectStakingHandlerL2");
    await withConfirmation(cL2Handler.connect(sDeployer).approveAllTokens());

    return {
      actions: [],
    };
  }
);
