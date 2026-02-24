const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "178_bridge_helper_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    await deployWithConfirmation("EthereumBridgeHelperModule", [safeAddress]);
    const cBridgeHelperModule = await ethers.getContract(
      "EthereumBridgeHelperModule"
    );

    console.log(
      `EthereumBridgeHelperModule (for ${safeAddress}) deployed to`,
      cBridgeHelperModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cBridgeHelperModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
