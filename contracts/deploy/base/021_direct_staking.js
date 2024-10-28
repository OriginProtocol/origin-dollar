const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../test/helpers");
// const { MAINNET_SELECTOR } = require("../../utils/ccip-chain-selectors");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "021_direct_staking",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    if (isFork) {
      await impersonateAndFund(deployerAddr);
    }

    // Deployer Actions
    // ----------------

    // 1. Deploy proxy and implementation contract
    await deployWithConfirmation("DirectStakingL2HandlerProxy");
    const cL2HandlerProxy = await ethers.getContract(
      "DirectStakingL2HandlerProxy"
    );
    console.log(
      "DirectStakingL2HandlerProxy deployed at",
      cL2HandlerProxy.address
    );

    const dL2Handler = await deployWithConfirmation("DirectStakingL2Handler", [
      addresses.base.ccipRouter,
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
    ]);
    console.log("Deployed DirectStakingL2Handler", dL2Handler.address);

    // prettier-ignore
    await withConfirmation(
      cL2HandlerProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dL2Handler.address,
          addresses.base.timelock,
          "0x"
        )
    );
    console.log("Initialized DirectStakingL2HandlerProxy");

    const cL2Handler = await ethers.getContractAt(
      "DirectStakingL2Handler",
      cL2HandlerProxy.address
    );

    return {
      actions: [
        {
          contract: cL2Handler,
          signature: "approveAllTokens()",
          args: [],
        },
        // TODO: Enable after deploying proxy
        // {
        //   contract: cL2Handler,
        //   signature: "addChainConfig(uint64,address)",
        //   args: [
        //     MAINNET_SELECTOR,
        //     addresses.mainnet.DirectStakingHandler
        //   ]
        // }
      ],
    };
  }
);
