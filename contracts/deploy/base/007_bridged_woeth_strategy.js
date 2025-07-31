const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "007_bridged_woeth_strategy",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    // Deploy oracle router
    await deployWithConfirmation("OETHBaseOracleRouter");
    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    // Cache decimals
    await withConfirmation(
      cOracleRouter.cacheDecimals(addresses.base.BridgedWOETH)
    );

    // Deploy proxy
    await deployWithConfirmation("BridgedWOETHStrategyProxy");
    const cStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    // Deploy implementation
    const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
      [addresses.zero, cOETHbVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      cOETHbProxy.address,
    ]);
    const cStrategy = await ethers.getContractAt(
      "BridgedWOETHStrategy",
      cStrategyProxy.address
    );

    // Init Strategy
    const initData = cStrategy.interface.encodeFunctionData(
      "initialize(uint128)",
      [
        100, // 1% maxPriceDiffBps
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dStrategyImpl.address,
          governorAddr,
          initData
        )
    );
    console.log("Initialized BridgedWOETHStrategyProxy");

    return {
      actions: [
        {
          // 1. Approve strategy
          contract: cOETHbVault,
          signature: "approveStrategy(address)",
          args: [cStrategyProxy.address],
        },
        {
          // 2. Add to mint whitelist
          contract: cOETHbVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cStrategyProxy.address],
        },
        {
          // 3. Update oracle price
          contract: cStrategy,
          signature: "updateWOETHOraclePrice()",
          args: [],
        },
        {
          // 4. Update oracle router
          contract: cOETHbVault,
          signature: "setPriceProvider(address)",
          args: [cOracleRouter.address],
        },
        {
          // 5. Set strategist as Harvester
          contract: cStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.base.strategist],
        },
      ],
    };
  }
);
