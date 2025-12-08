const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "155_oeth_zapper",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETH = await ethers.getContract("OETHProxy");
    const cwOETH = await ethers.getContract("WOETHProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new Compounding Staking Strategy contracts
    const dZapper = await deployWithConfirmation(
      "OETHZapper",
      [
        cOETH.address,
        cwOETH.address,
        cVaultProxy.address,
        addresses.mainnet.WETH,
      ],
      undefined,
      true
    );
    const cZapper = await ethers.getContractAt("OETHZapper", dZapper.address);
    console.log(`OETHZapper deployed to ${cZapper.address}`);

    // Governance Actions
    // ----------------
    return {
      name: "",
      actions: [],
    };
  }
);
