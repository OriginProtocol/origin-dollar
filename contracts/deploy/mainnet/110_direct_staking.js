const { isFork } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
// const { BASE_SELECTOR } = require("../../utils/ccip-chain-selectors");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "110_direct_staking",
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    deployerIsProposer: false, // just to solve the issue of later active proposals failing
    proposalId: "",
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
    await deployWithConfirmation("DirectStakingMainnetHandlerProxy");
    const cMainnetHandlerProxy = await ethers.getContract(
      "DirectStakingMainnetHandlerProxy"
    );
    console.log(
      "DirectStakingMainnetHandlerProxy deployed at",
      cMainnetHandlerProxy.address
    );

    const dMainnetHandler = await deployWithConfirmation(
      "DirectStakingMainnetHandler",
      [
        addresses.mainnet.ccipRouter,
        addresses.mainnet.WETH,
        addresses.mainnet.OETHVaultProxy,
        addresses.mainnet.OETHProxy,
        addresses.mainnet.WOETHProxy,
      ]
    );
    console.log(
      "Deployed DirectStakingMainnetHandler",
      dMainnetHandler.address
    );

    // prettier-ignore
    await withConfirmation(
      cMainnetHandlerProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dMainnetHandler.address,
          addresses.mainnet.Timelock,
          "0x"
        )
    );
    console.log("Initialized DirectStakingMainnetHandlerProxy");

    const cMainnetHandler = await ethers.getContractAt(
      "DirectStakingMainnetHandler",
      cMainnetHandlerProxy.address
    );

    return {
      name: "Deploy direct staking contract",
      actions: [
        {
          contract: cMainnetHandler,
          signature: "approveAllTokens()",
          args: [],
        },
        // TODO: Enable after deploying proxy
        // {
        //   contract: cMainnetHandler,
        //   signature: "addChainConfig(uint64,address)",
        //   args: [
        //     BASE_SELECTOR,
        //     addresses.base.DirectStakingHandler
        //   ]
        // }
      ],
    };
  }
);
