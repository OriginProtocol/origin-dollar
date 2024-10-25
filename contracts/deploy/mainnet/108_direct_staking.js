const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "108_direct_staking",
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    deployerIsProposer: false, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy contract
    const dMainnetHandler = await deployWithConfirmation(
      "DirectStakingHandlerMainnet",
      [
        addresses.mainnet.ccipRouter,
        addresses.mainnet.WETH,
        addresses.mainnet.OETHVaultProxy,
        addresses.mainnet.OETHProxy,
        addresses.mainnet.WOETHProxy,
      ]
    );
    console.log(
      "Deployed DirectStakingHandlerMainnet",
      dMainnetHandler.address
    );

    const { deployerAddr } = await getNamedAccounts();
    await impersonateAndFund(deployerAddr);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cMainnetHandler = await ethers.getContract(
      "DirectStakingHandlerMainnet"
    );
    await withConfirmation(
      cMainnetHandler.connect(sDeployer).approveAllTokens()
    );

    return {};
  }
);
