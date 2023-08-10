const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "047_morpho_aave_strategy",
    forceDeploy: false,
    proposalId: 43,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dMorphoAaveStrategyProxy = await deployWithConfirmation(
      "MorphoAaveStrategyProxy"
    );
    const cMorphoAaveStrategyProxy = await ethers.getContractAt(
      "MorphoAaveStrategyProxy",
      dMorphoAaveStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dMorphoAaveStrategyImpl = await deployWithConfirmation(
      "MorphoAaveStrategy"
    );
    const cMorphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      dMorphoAaveStrategyProxy.address
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cMorphoAaveStrategyProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dMorphoAaveStrategyImpl.address, deployerAddr, [], await getTxOpts())
    );

    // 4. Init and configure new Morpho strategy
    const initFunction = "initialize(address,address[],address[],address[])";
    await withConfirmation(
      cMorphoAaveStrategy.connect(sDeployer)[initFunction](
        cVaultProxy.address,
        [], // reward token addresses
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], // asset token addresses
        [assetAddresses.aDAI, assetAddresses.aUSDC, assetAddresses.aUSDT], // platform tokens addresses
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cMorphoAaveStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    console.log("Morpho Aave strategy address: ", cMorphoAaveStrategy.address);
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Morpho Aave strategy",
      actions: [
        // 1. Accept governance of new MorphoAaveStrategy
        {
          contract: cMorphoAaveStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new Morpho strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMorphoAaveStrategy.address],
        },
        // 3. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [dMorphoAaveStrategyProxy.address, true],
        },
        // 4. Set harvester address
        {
          contract: cMorphoAaveStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
