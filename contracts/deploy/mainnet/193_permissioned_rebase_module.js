const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "193_permissioned_rebase_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const safeAddress = addresses.multichainStrategist;

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    await deployWithConfirmation("PermissionedRebaseModule", [
      safeAddress,
      addresses.talosRelayer,
      [cVaultProxy.address, cOETHVaultProxy.address],
    ]);
    const cPermissionedRebaseModule = await ethers.getContract(
      "PermissionedRebaseModule"
    );
    console.log(
      `PermissionedRebaseModule deployed to ${cPermissionedRebaseModule.address}`
    );

    // TODO: After deployment, the Multichain Strategist Safe must call
    // enableModule(cPermissionedRebaseModule.address) for this module to be
    // able to act on the OUSD and OETH vaults.

    return {
      actions: [],
    };
  }
);
