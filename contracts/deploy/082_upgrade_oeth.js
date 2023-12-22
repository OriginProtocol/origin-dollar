const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "082_upgrade_oeth",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId:
      "71383011691589635543710677825410966722324428905533481831290224502800746995692",
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
      name: "Upgrade OETH token contract\n\
      \n\
      When contracts integrate with OETH protocol they can already opt-in to rebasing. This governance proposal enables OGV governance to enable rebasing for any 3rd party contract to better streamline integrations.\n\
      \n\
      This proposal also enables rebasing of EigenLayer contract.\n\
      \n\
      ",
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
