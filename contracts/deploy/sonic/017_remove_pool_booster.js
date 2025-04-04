const { deployOnSonic } = require("../../utils/deploy-l2");
module.exports = deployOnSonic(
  {
    deployName: "017_remove_pool_booster",
  },
  async ({ ethers }) => {
    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle"
    );

    return {
      name: "Remove 3 pool booster from Pool Booster Factory SwapxSingle",
      actions: [
        {
          // Protocol: THC
          // THC/OS SwapX Pool booster
          contract: cPoolBoosterFactorySwapxSingle,
          signature: "removePoolBooster(address)",
          args: ["0xcAc8E01CeeC490F82276A350f395Ab12F089BBe5"],
        },
        {
          // Protocol: GEMSx
          // GEMsx/OS SwapX Pool booster
          contract: cPoolBoosterFactorySwapxSingle,
          signature: "removePoolBooster(address)",
          args: ["0x1ea8Db4053f806636250bb2BFa6B1E0c4923c209"],
        },
        {
          // Protocol: SWAPx
          // SWPx/OS SwapX Pool booster
          contract: cPoolBoosterFactorySwapxSingle,
          signature: "removePoolBooster(address)",
          args: ["0x46b210Dd7217A37357bF076AA78e09330a974e33"],
        },
      ],
    };
  }
);
