const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "035_claimbribes_module_old_guardian",
  },
  async ({ ethers }) => {
    const voter = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
    const veAero = "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4";

    await deployWithConfirmation(
      "ClaimBribesSafeModule3",
      [
        // Old Guardian Safe
        addresses.base.strategist,
        voter,
        veAero,
      ],
      "ClaimBribesSafeModule"
    );

    const cClaimBribesSafeModule3 = await ethers.getContract(
      "ClaimBribesSafeModule3"
    );
    console.log(
      "ClaimBribesSafeModule3 deployed at",
      cClaimBribesSafeModule3.address
    );

    return {};
  }
);
