const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "127_replace_dai_with_usds",
    reduceQueueTime: true,
    // forceSkip: true,
    deployerIsProposer: false,
    proposalId: "",
    // TODO: Temporary hack to test it on CI
    simulateDirectlyOnTimelock: isFork,
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation, ethers }) => {
    const DAI = addresses.mainnet.DAI;
    const USDS = addresses.mainnet.USDS;
    const sUSDS = addresses.mainnet.sUSDS;

    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);
    const cDSRStrategyProxy = await ethers.getContract("MakerDsrStrategyProxy");

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

    // 1. Deploy OracleRouter
    await deployWithConfirmation("OracleRouter");
    const cOracleRouter = await ethers.getContract("OracleRouter");
    await withConfirmation(
      cOracleRouter.connect(sDeployer).cacheDecimals(USDS)
    );

    // 2. Deploy Migration Strategy
    const dMigrationStrategy = await deployWithConfirmation(
      "DAIMigrationStrategy",
      [
        {
          vaultAddress: cVaultProxy.address,
          platformAddress: addresses.mainnet.DaiUsdsMigrationContract,
        },
        DAI,
        USDS,
        timelockAddr,
      ]
    );

    const migrationStrategy = await ethers.getContractAt(
      "DAIMigrationStrategy",
      dMigrationStrategy.address
    );

    // 3. Deploy SSR Strategy
    const dMakerSSRStrategyProxy = await deployWithConfirmation(
      "MakerSSRStrategyProxy"
    );
    const dMakerSSRStrategy = await deployWithConfirmation(
      "Generalized4626Strategy",
      [[sUSDS, cVaultProxy.address], USDS]
    );
    const cMakerSSRStrategyProxy = await ethers.getContract(
      "MakerSSRStrategyProxy"
    );
    const cMakerSSRStrategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      dMakerSSRStrategyProxy.address
    );

    // 4. Initialize the SSR Strategy
    const initData = cMakerSSRStrategy.interface.encodeFunctionData(
      "initialize()",
      []
    );
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cMakerSSRStrategyProxy.connect(sDeployer)[initFunction](
        dMakerSSRStrategy.address,
        timelockAddr, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    return {
      name: "Replace DAI with USDS",
      actions: [
        {
          // Upgrade VaultAdmin implementation
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        {
          // Set OracleRouter on Vault
          contract: cVault,
          signature: "setPriceProvider(address)",
          args: [cOracleRouter.address],
        },
        {
          // Support USDS on Vault
          contract: cVault,
          signature: "supportAsset(address,uint8)",
          args: [USDS, 0],
        },

        {
          // Approve Migration Strategy on the Vault
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [migrationStrategy.address],
        },
        {
          // Approve SSR Strategy on the Vault
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cMakerSSRStrategy.address],
        },
        {
          // Set Migration Strategy as default for DAI
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [DAI, migrationStrategy.address],
        },
        {
          // Set Maker SSR Strategy as default for USDS
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [USDS, cMakerSSRStrategy.address],
        },
        {
          // Remove DSR strategy
          // This would move all DAI to vault
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cDSRStrategyProxy.address],
        },
        {
          // Allocate DAI from the Vault to the Migration Strategy
          contract: cVault,
          signature: "allocate()",
          args: [],
        },
        {
          // Reset default strategy for DAI so that we can remove it
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [DAI, addresses.zero],
        },
        {
          // Remove Migration Strategy
          // This will remove all USDS and move it to the Vault
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [migrationStrategy.address],
        },

        // {
        //   // Optional: Allocate USDS from the Vault to the SSR Strategy
        //   contract: cVault,
        //   signature: "allocate()",
        //   args: [],
        // },

        {
          // Remove DAI
          contract: cVault,
          signature: "removeAsset(address)",
          args: [DAI],
        },

        // Harvester related things
        {
          // Set Harvester in the SSR Strategy
          contract: cMakerSSRStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // Add SSR Strategy to the Harvester
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMakerSSRStrategy.address, true],
        },
        {
          // Remove DSR Strategy from the Harvester
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cDSRStrategyProxy.address, false],
        },

        {
          // Set Oracle Slippage for USDS
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [USDS, 25],
        },
      ],
    };
  }
);
