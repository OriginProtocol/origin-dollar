const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");
const {
  deployBaseAerodromeAMOStrategyImplementation,
} = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "017_upgrade_amo",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAMOStrategyImpl =
      await deployBaseAerodromeAMOStrategyImplementation();
    const cAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAMOStrategyProxy.address
    );

    return {
      actions: [
        {
          // 1. Upgrade AMO
          contract: cAMOStrategyProxy,
          signature: "upgradeTo(address)",
          args: [cAMOStrategyImpl.address],
        },
        {
          // 2. Reset WETH approvals to 0 on swapRouter and positionManager
          contract: cAMOStrategy,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        {
          // 2. set auto allocate threshold to 0.1 - gas is cheap
          contract: cOETHbVault,
          signature: "setAutoAllocateThreshold(uint256)",
          args: [utils.parseUnits("0.1", 18)],
        },
        // {
        //   // 3. set that 0.04% (4 basis points) of Vualt TVL triggers the allocation.
        //   // At the time of writing this is ~53 ETH
        //   contract: cOETHbVault,
        //   signature: "setVaultBuffer(uint256)",
        //   args: [utils.parseUnits("4", 14)],
        // },
        {
          // 3. for now disable allocating weth
          contract: cOETHbVault,
          signature: "setVaultBuffer(uint256)",
          args: [utils.parseUnits("1", 18)],
        },
        {
          // 4. set aerodrome AMO as WETH asset default strategy
          contract: cOETHbVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.base.WETH, cAMOStrategyProxy.address],
        },
      ],
    };
  }
);
