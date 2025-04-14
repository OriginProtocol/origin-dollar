const { deployOnSonic } = require("../../utils/deploy-l2");
const { resolveContract } = require("../../utils/resolvers");

module.exports = deployOnSonic(
  {
    deployName: "015_redeem_fee",
  },
  async () => {
    const cOSonicVault = await resolveContract("OSonicVaultProxy", "IVault");

    return {
      actions: [
        {
          // Set redeem fee to 0.1%
          contract: cOSonicVault,
          signature: "setRedeemFeeBps(uint256)",
          args: [ethers.BigNumber.from("10")],
        },
      ],
    };
  }
);
