const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../utils/hardhat-helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "186_merkl_pb_bribes_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    await deployWithConfirmation("MerklPoolBoosterBribesModule", [
      safeAddress,
      addresses.mainnet.validatorRegistrator,
      "0xC67436e3c9c24aFBd33782DE930Fbd328EA0A752", // PoolBoosterFactoryMerkl mainnet
    ]);
    const cMerklModule = await ethers.getContract(
      "MerklPoolBoosterBribesModule"
    );

    console.log(
      `MerklPoolBoosterBribesModule (for ${safeAddress}) deployed to`,
      cMerklModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);
      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cMerklModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
