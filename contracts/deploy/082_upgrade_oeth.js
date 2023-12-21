const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "082_upgrade_oeth",
    forceDeploy: false,
    reduceQueueTime: true
  },
  async ({ ethers, deployWithConfirmation }) => {
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const eigenLayerStrategyContract =
      "0xa4c637e0f704745d182e4d38cab7e7485321d059";

    // Deploy new version of OETH contract
    const dOETHImpl = await deployWithConfirmation("OETH", []);

    const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH AMO strategy with peg keeping functions.",
      actions: [
        // Upgrade the OETH token proxy contract to the new implementation
        {
          contract: cOETHProxy,
          signature: "upgradeTo(address)",
          args: [dOETHImpl.address],
        },
        {
          contract: cOETH,
          signature: "governanceRebaseOptIn(address)",
          args: [eigenLayerStrategyContract],
        },
      ],
    };
  }
);
