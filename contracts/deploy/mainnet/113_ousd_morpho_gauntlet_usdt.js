const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "113_ousd_morpho_gauntlet_usdt",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "81633492285999845572989946154472567378435839827604776411913516896058378421073",
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation }) => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // Deployer Actions
    // ----------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new Morpho Gauntlet Prime USDT Strategy proxy
    const dMorphoGauntletPrimeUSDTProxy = await deployWithConfirmation(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cMorphoGauntletPrimeUSDTProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    // 2. Deploy new Generalized4626USDTStrategy contract as it has an immutable to the Morpho Vault contract
    const dGeneralized4626USDTStrategy = await deployWithConfirmation(
      "Generalized4626USDTStrategy",
      [
        [addresses.mainnet.MorphoGauntletPrimeUSDTVault, cVaultProxy.address],
        addresses.mainnet.USDT,
      ]
    );
    const cMorphoGauntletPrimeUSDT = await ethers.getContractAt(
      "Generalized4626USDTStrategy",
      dMorphoGauntletPrimeUSDTProxy.address
    );

    // 3. Construct initialize call data to initialize and configure the new strategy
    const initData = cMorphoGauntletPrimeUSDT.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cMorphoGauntletPrimeUSDTProxy.connect(sDeployer)[initFunction](
        dGeneralized4626USDTStrategy.address,
        addresses.mainnet.Timelock, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // Governance Actions
    // ----------------
    return {
      name: "Add Morpho Gauntlet Prime USDT Strategy to the OUSD Vault",
      actions: [
        {
          // Add the new strategy to the vault
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cMorphoGauntletPrimeUSDT.address],
        },
        {
          // Add the new strategy to the Harvester
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMorphoGauntletPrimeUSDT.address, true],
        },
        {
          // Set the Harvester in the new strategy
          contract: cMorphoGauntletPrimeUSDT,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
