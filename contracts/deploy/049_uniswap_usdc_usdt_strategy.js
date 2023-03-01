const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "049_uniswap_usdc_usdt_strategy",
    forceDeploy: false,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr, operatorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt(
      "Vault",
      cVaultProxy.address
    );
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 0. Deploy UniswapV3Helper
    const dUniswapV3Helper = await deployWithConfirmation("UniswapV3Helper")

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
      "GeneralizedUniswapV3Strategy"
    );
    const cUniV3_USDC_USDT_Strategy = await ethers.getContractAt(
      "GeneralizedUniswapV3Strategy",
      dUniV3_USDC_USDT_Proxy.address
    );

    const cMorphoCompProxy = await ethers.getContract("MorphoCompoundStrategyProxy");

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    console.log(governorAddr, await cMorphoCompProxy.governor())

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
    const initFunction = "initialize(address,address,address,address,address,address,address)";
    await withConfirmation(
      cUniV3_USDC_USDT_Strategy.connect(sDeployer)[initFunction](
        cVaultProxy.address, // Vault
        assetAddresses.UniV3_USDC_USDT_Pool, // Pool address
        assetAddresses.UniV3PositionManager, // NonfungiblePositionManager
        cMorphoCompProxy.address, // Reserve strategy for USDC
        cMorphoCompProxy.address, // Reserve strategy for USDT
        operatorAddr,
        dUniswapV3Helper.address,
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cUniV3_USDC_USDT_Strategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    console.log("Uniswap V3 (USDC-USDT pool) strategy address: ", cUniV3_USDC_USDT_Strategy.address);
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
        // // 1. Accept governance of new cUniV3_USDC_USDT_Strategy
        // {
        //   contract: cUniV3_USDC_USDT_Strategy,
        //   signature: "claimGovernance()",
        //   args: [],
        // },
        // // 2. Add new strategy to vault
        // {
        //   contract: cVaultAdmin,
        //   signature: "approveUniswapV3Strategy(address)",
        //   args: [cUniV3_USDC_USDT_Proxy.address],
        // },
        // // 3. Set supported strategy on Harvester
        // {
        //   contract: cHarvester,
        //   signature: "setSupportedStrategy(address,bool)",
        //   args: [cUniV3_USDC_USDT_Proxy.address, true],
        // },
        // // 4. Set harvester address
        // {
        //   contract: cUniV3_USDC_USDT_Strategy,
        //   signature: "setHarvesterAddress(address)",
        //   args: [cHarvesterProxy.address],
        // },
      ],
    };
  }
);
