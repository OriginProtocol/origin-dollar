const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "111_morpho_wrap_and_transfer",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "52303668283507532886105041405617076369748861896782994594114630508874108983718",
  },
  async () => {
    const { strategistAddr } = await getNamedAccounts();

    const cLegacyMorpho = await ethers.getContractAt(
      [
        "function approve(address,uint256) external",
        "function balanceOf(address) external view returns(uint256)",
      ],
      "0x9994E35Db50125E0DF82e4c2dde62496CE330999"
    );

    const cWrapperContract = await ethers.getContractAt(
      ["function depositFor(address,uint256) external"],
      "0x9D03bb2092270648d7480049d0E58d2FcF0E5123"
    );

    const currentBalance = await cLegacyMorpho.balanceOf(
      addresses.mainnet.Timelock
    );

    // Governance Actions
    // ----------------
    return {
      name: "Transfer Morpho tokens from Timelock to the Guardian",
      actions: [
        {
          contract: cLegacyMorpho,
          signature: "approve(address,uint256)",
          args: [cWrapperContract.address, currentBalance],
        },
        {
          contract: cWrapperContract,
          signature: "depositFor(address,uint256)",
          args: [strategistAddr, currentBalance],
        },
      ],
    };
  }
);
