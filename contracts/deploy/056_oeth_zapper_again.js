const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "056_oeth_zapper_again", forceDeploy: false },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new Zapper
    await deployWithConfirmation(
      "OETHZapper",
      [
        "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3",
        "0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab",
      ],
      undefined,
      true
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy updated zapper",
      actions: [],
    };
  }
);
