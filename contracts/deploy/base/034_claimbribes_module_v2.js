const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "034_claimbribes_module_v2",
  },
  async ({ ethers }) => {
    const voter = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
    const veAero = "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4";

    await deployWithConfirmation(
      "ClaimBribesSafeModule1",
      [
        // AERO locker Safe
        "0xb6D85Ce798660076152d6FD3a484129668839c95",
        voter,
        veAero,
      ],
      "ClaimBribesSafeModule"
    );

    const cClaimBribesSafeModule1 = await ethers.getContract(
      "ClaimBribesSafeModule1"
    );
    console.log(
      "ClaimBribesSafeModule1 deployed at",
      cClaimBribesSafeModule1.address
    );

    await deployWithConfirmation(
      "ClaimBribesSafeModule2",
      [
        // Multichain Guardian Safe
        addresses.multichainStrategist,
        voter,
        veAero,
      ],
      "ClaimBribesSafeModule"
    );

    const cClaimBribesSafeModule2 = await ethers.getContract(
      "ClaimBribesSafeModule2"
    );
    console.log(
      "ClaimBribesSafeModule2 deployed at",
      cClaimBribesSafeModule2.address
    );

    return {};
  }
);
