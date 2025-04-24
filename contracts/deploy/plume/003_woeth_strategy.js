const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "003_woeth_strategy",
  },
  async ({ ethers }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();

    const sDeployer = await ethers.getSigner(deployerAddr);

    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");
    const cOETHpProxy = await ethers.getContract("OETHPlumeProxy");
    const cOETHpVault = await ethers.getContractAt(
      "IVault",
      cOETHpVaultProxy.address
    );

    // Deploy oracle router
    await deployWithConfirmation("OETHPlumeOracleRouter");
    const cOracleRouter = await ethers.getContract("OETHPlumeOracleRouter");

    // Cache decimals
    await withConfirmation(
      cOracleRouter.cacheDecimals(addresses.plume.BridgedWOETH)
    );

    // Deploy proxy
    await deployWithConfirmation("BridgedWOETHStrategyProxy");
    const cStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    // Deploy implementation
    const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
      [addresses.zero, cOETHpVaultProxy.address],
      addresses.plume.WETH,
      addresses.plume.BridgedWOETH,
      cOETHpProxy.address,
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
          timelockAddr,
          initData
        )
    );
    console.log("Initialized BridgedWOETHStrategyProxy");

    return {
      actions: [
        {
          // 1. Update oracle router
          contract: cOETHpVault,
          signature: "setPriceProvider(address)",
          args: [cOracleRouter.address],
        },
        {
          // 2. Approve strategy
          contract: cOETHpVault,
          signature: "approveStrategy(address)",
          args: [cStrategyProxy.address],
        },
        {
          // 3. Add to mint whitelist
          contract: cOETHpVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cStrategyProxy.address],
        },
        {
          // 4. Update oracle price
          contract: cStrategy,
          signature: "updateWOETHOraclePrice()",
          args: [],
        },
        {
          // 5. Set strategist as Harvester
          contract: cStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.plume.strategist],
        },
      ],
    };
  }
);
