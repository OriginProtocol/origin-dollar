const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "132_omnichain_adapter",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();

    const cWOETHProxy = await ethers.getContract("WOETHProxy");

    // NOTE: For now, deployer is the governor to test things out
    const dOmnichainMainnetAdapter = await deployWithConfirmation(
      "OmnichainMainnetAdapter",
      [cWOETHProxy.address, addresses.mainnet.LayerZeroEndpointV2, deployerAddr]
    );

    console.log(
      "OmnichainMainnetAdapter address:",
      dOmnichainMainnetAdapter.address
    );

    return {};
  }
);
