const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "056_pause_safe_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // The Hypernative keeper address is not known yet. Deploy with the Talos
    // relayer as the initial operator; the Safe grants OPERATOR_ROLE to the
    // keeper once the vendor supplies its address (see checklist below).
    const operators = [addresses.talosRelayer];

    await deployWithConfirmation("PauseSafeModule", [
      safeAddress,
      operators,
      [cOETHbVaultProxy.address],
    ]);
    const cPauseSafeModule = await ethers.getContract("PauseSafeModule");

    console.log(
      `PauseSafeModule (for ${safeAddress}) deployed to`,
      cPauseSafeModule.address
    );
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
