const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnBase(
  {
    deployName: "034_claimbribes_module_v2",
  },
  async ({ ethers }) => {
    const safeAddress = "0xb6D85Ce798660076152d6FD3a484129668839c95";
    const voter = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
    const veAero = "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4";

    await deployWithConfirmation("ClaimBribesSafeModule", [
      safeAddress,
      voter,
      veAero,
    ]);
    const cClaimBribesSafeModule = await ethers.getContract(
      "ClaimBribesSafeModule"
    );
    console.log(
      "ClaimBribesSafeModule deployed at",
      cClaimBribesSafeModule.address
    );

    return {};
  }
);
