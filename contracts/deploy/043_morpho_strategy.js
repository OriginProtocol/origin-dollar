const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "043_morpho_strategy", forceDeploy: true },
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
    const dMorphoCompoundStrategyProxy = await deployWithConfirmation(
      "MorphoCompoundStrategyProxy"
    );
    const cMorphoCompoundStrategyProxy = await ethers.getContractAt(
      "MorphoCompoundStrategyProxy",
      dMorphoCompoundStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dMorphoCompoundStrategyImpl = await deployWithConfirmation(
      "MorphoCompoundStrategy"
    );
    const cMorphoCompoundStrategy = await ethers.getContractAt(
      "MorphoCompoundStrategy",
      dMorphoCompoundStrategyImpl.address
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cMorphoCompoundStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dMorphoCompoundStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 4. Init and configure new Morpho strategy
    const initFunction =
      "initialize(address,address[],address[],address[])";
    await withConfirmation(
      cMorphoCompoundStrategy.connect(sDeployer)[initFunction](
        cVaultProxy.address,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], // reward token addresses
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], // asset token addresses
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cMorphoCompoundStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Morpho Compound strategy",
      actions: [
        // 3. Accept governance of new MorphoCompoundStrategy
        {
          contract: cMorphoCompoundStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 4. Add new Morpho strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMorphoCompoundStrategy.address],
        },
        // 7. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMorphoCompoundStrategy.address, true],
        },
        // 8. Set harvester address
        {
          contract: cMorphoCompoundStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);