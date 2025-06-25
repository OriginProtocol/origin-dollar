const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "143_bridge_helper_module_upgrade",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    await deployWithConfirmation("EthereumBridgeHelperModule", [
      addresses.multichainStrategist,
    ]);
    const cEthereumBridgeHelperModule = await ethers.getContract(
      "EthereumBridgeHelperModule"
    );

    console.log(
      "EthereumBridgeHelperModule deployed to",
      cEthereumBridgeHelperModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(
        addresses.multichainStrategist
      );

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        addresses.multichainStrategist
      );

      await withConfirmation(
        cSafe
          .connect(safeSigner)
          .enableModule(cEthereumBridgeHelperModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
