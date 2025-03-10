const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "128_deploy_flipper",
    reduceQueueTime: true,
    // forceSkip: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, ethers }) => {
    const { deployerAddr, multichainStrategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const dFlipper = await deployWithConfirmation("Flipper", [
      addresses.mainnet.OUSD,
      addresses.mainnet.USDS,
      addresses.mainnet.USDC,
      addresses.mainnet.USDT,
    ]);

    const cFlipper = await ethers.getContractAt("Flipper", dFlipper.address);

    console.log("Flipper deployed at", dFlipper.address);

    // Transfer governance to multichain strategist
    await cFlipper
      .connect(sDeployer)
      .transferGovernance(multichainStrategistAddr);

    // No Governance actions
    return {};
  }
);
