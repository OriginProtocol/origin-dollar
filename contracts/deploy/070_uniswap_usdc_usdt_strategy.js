const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { utils } = require("ethers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "070_uniswap_usdc_usdt_strategy",
    forceDeploy: false,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, operatorAddr, timelockAddr } =
      await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 0. Deploy UniswapV3Helper
    const dUniswapV3Helper = await deployWithConfirmation("UniswapV3Helper");

    // 0. Upgrade VaultAdmin
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dVaultCore = await deployWithConfirmation("VaultCore");

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dUniV3_USDC_USDT_Proxy = await deployWithConfirmation(
      "UniV3_USDC_USDT_Proxy"
    );
    const cUniV3_USDC_USDT_Proxy = await ethers.getContractAt(
      "UniV3_USDC_USDT_Proxy",
      dUniV3_USDC_USDT_Proxy.address
    );

    // 2. Deploy new implementation
    const dUniV3_USDC_USDT_StrategyImpl = await deployWithConfirmation(
      "UniswapV3Strategy"
    );
    const dUniV3PoolLiquidityManager = await deployWithConfirmation(
      "UniswapV3LiquidityManager"
    );
    const cUniV3_USDC_USDT_Strategy = await ethers.getContractAt(
      "UniswapV3Strategy",
      dUniV3_USDC_USDT_Proxy.address
    );

    const cMorphoAaveProxy = await ethers.getContract(
      "MorphoAaveStrategyProxy"
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cUniV3_USDC_USDT_Proxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dUniV3_USDC_USDT_StrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 4. Init and configure new Uniswap V3 strategy
    const initFunction =
      "initialize(address,address,address,address,address,address,uint256,uint256)";
    await withConfirmation(
      cUniV3_USDC_USDT_Strategy.connect(sDeployer)[initFunction](
        cVaultProxy.address, // Vault
        assetAddresses.UniV3_USDC_USDT_Pool, // Pool address
        assetAddresses.UniV3PositionManager, // NonfungiblePositionManager
        dUniswapV3Helper.address,
        assetAddresses.UniV3SwapRouter,
        operatorAddr,
        utils.parseEther("1000000", 18), // 1M, max TVL
        utils.parseEther("50000", 18), // 50k, lost value threshold
        await getTxOpts()
      )
    );

    // 5. Set LiquidityManager Implementation
    await withConfirmation(
      cUniV3_USDC_USDT_Strategy
        .connect(sDeployer)
        .setLiquidityManagerImpl(dUniV3PoolLiquidityManager.address)
    );

    // 6. Transfer governance
    await withConfirmation(
      cUniV3_USDC_USDT_Strategy
        .connect(sDeployer)
        .transferGovernance(timelockAddr, await getTxOpts())
    );

    console.log(
      "Uniswap V3 (USDC-USDT pool) strategy address: ",
      cUniV3_USDC_USDT_Strategy.address
    );
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Uniswap V3 (USDC-USDT pool) strategy",
      actions: [
        // 0. Set VaultCore implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 0. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 1. Accept governance of new cUniV3_USDC_USDT_Strategy
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveUniswapV3Strategy(address)",
          args: [cUniV3_USDC_USDT_Proxy.address],
        },
        // 3. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cUniV3_USDC_USDT_Proxy.address, true],
        },
        // 4. Set harvester address
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 5. Set Reserve Strategy for USDC
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setReserveStrategy(address,address)",
          args: [assetAddresses.USDC, cMorphoAaveProxy.address],
        },
        // 6. Set Reserve Strategy for USDT
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setReserveStrategy(address,address)",
          args: [assetAddresses.USDT, cMorphoAaveProxy.address],
        },
        // 7. Set Minimum Deposit threshold for USDC
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setMinDepositThreshold(address,uint256)",
          args: [assetAddresses.USDC, utils.parseUnits("30000", 6)], // 30k
        },
        // 8. Set Minimum Deposit threshold for USDT
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setMinDepositThreshold(address,uint256)",
          args: [assetAddresses.USDT, utils.parseUnits("30000", 6)], // 30k
        },
        // 9. Set Rebalance Price Threshold
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setRebalancePriceThreshold(int24,int24)",
          args: [-1000, 1000],
        },
        // 10. Set Swap price threshold
        {
          contract: cUniV3_USDC_USDT_Strategy,
          signature: "setSwapPriceThreshold(int24,int24)",
          args: [-1000, 1000],
        },
      ],
    };
  }
);
