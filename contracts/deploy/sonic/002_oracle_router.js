const { deployOnSonic } = require("../../utils/deploy-l2.js");
const { deployOracles } = require("../deployActions");

module.exports = deployOnSonic(
  {
    deployName: "002_oracle_router",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    await deployOracles();
    const oracleRouter = await ethers.getContract("OSonicOracleRouter");
    console.log(`Deployed Oracle Router at: ${oracleRouter.address}`);

    return {
      name: "Configure Oracle Router as Price provider",
      actions: [
        // 1. Approve Sonic Staking Strategy on the Vault
        {
          contract: cOSonicVault,
          signature: "setPriceProvider(address)",
          args: [oracleRouter.address],
        },
      ],
    };
  }
);
