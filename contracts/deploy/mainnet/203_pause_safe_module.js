const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "203_pause_safe_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const safeAddress = addresses.multichainStrategist;

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    // The Hypernative keeper address is not known yet. Deploy with the Talos
    // relayer as the initial operator; the Safe grants OPERATOR_ROLE to the
    // keeper once the vendor supplies its address (see checklist below).
    const operators = [addresses.talosRelayer];

    await deployWithConfirmation("PauseSafeModule", [
      safeAddress,
      operators,
      [cVaultProxy.address, cOETHVaultProxy.address],
    ]);
    const cPauseSafeModule = await ethers.getContract("PauseSafeModule");

    console.log(`PauseSafeModule deployed to ${cPauseSafeModule.address}`);
    console.log(`
=======================================================================
REQUIRED POST-DEPLOY STEPS — the module does nothing until these are done
=======================================================================
  1. Guardian Safe (${safeAddress}) calls:
       enableModule(${cPauseSafeModule.address})
  2. Verify on-chain:
       safe.isModuleEnabled(${cPauseSafeModule.address}) == true
  3. Guardian Safe grants the Hypernative keeper the operator role:
       pauseSafeModule.grantRole(OPERATOR_ROLE, <hypernative keeper>)
  4. Smoke-test one pauseCapital() on a fork before arming detection.

  Step 1 is the one that was silently skipped for PermissionedRebaseModule,
  leaving it dead on-chain for months. Do not close this PR until it is done.
=======================================================================
`);

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);
      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cPauseSafeModule.address)
      );

      console.log("Enabled PauseSafeModule on fork");
    }

    return {
      actions: [],
    };
  }
);
