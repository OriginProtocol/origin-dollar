const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "110_transfer_morpho",
    forceDeploy: false,
    forceSkip: true,
    skipSimulation: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cOUSDMorphoAaveProxy = await ethers.getContract(
      "MorphoAaveStrategyProxy"
    );
    const cOUSDMorphoCompoundProxy = await ethers.getContract(
      "MorphoCompoundStrategyProxy"
    );
    const cOETHMorphoAaveProxy = await ethers.getContract(
      "OETHMorphoAaveStrategyProxy"
    );

    const cOUSDMorphoAave = await ethers.getContractAt(
      "InitializableAbstractStrategy",
      cOUSDMorphoAaveProxy.address
    );
    const cOUSDMorphoCompound = await ethers.getContractAt(
      "InitializableAbstractStrategy",
      cOUSDMorphoCompoundProxy.address
    );
    const cOETHMorphoAave = await ethers.getContractAt(
      "InitializableAbstractStrategy",
      cOETHMorphoAaveProxy.address
    );

    const morpho = await ethers.getContractAt(
      "IERC20",
      "0x9994e35db50125e0df82e4c2dde62496ce330999"
    );

    const ousdAaveBalance = await morpho.balanceOf(cOUSDMorphoAave.address);
    const ousdCompBalance = await morpho.balanceOf(cOUSDMorphoCompound.address);
    const oethAaveBalance = await morpho.balanceOf(cOETHMorphoAave.address);

    // Governance Actions
    // ----------------
    return {
      name: "Transfer Morpho Tokens from Strategies to the Guardian",
      actions: [
        {
          contract: cOUSDMorphoAave,
          signature: "transferToken(address,uint256)",
          args: [morpho.address, ousdAaveBalance],
        },
        {
          contract: cOUSDMorphoCompound,
          signature: "transferToken(address,uint256)",
          args: [morpho.address, ousdCompBalance],
        },
        {
          contract: cOETHMorphoAave,
          signature: "transferToken(address,uint256)",
          args: [morpho.address, oethAaveBalance],
        },
      ],
    };
  }
);
