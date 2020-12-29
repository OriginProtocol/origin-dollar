const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

/**
 * Deploy AAVE Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dAaveStrategyProxy = await deployWithConfirmation(
    "AaveStrategyProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    dAaveStrategyProxy.address
  );
  await withConfirmation(
    cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized AaveStrategyProxy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      addresses.zero, // No reward token for Aave
      [assetAddresses.DAI],
      [assetAddresses.aDAI]
    )
  );
  log("Initialized AaveStrategy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`AaveStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cAaveStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for AaveStrategy");
  }

  return cAaveStrategy;
};

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dCompoundStrategyProxy = await deployWithConfirmation(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    dCompoundStrategyProxy.address
  );
  await withConfirmation(
    cCompoundStrategyProxy["initialize(address,address,bytes)"](
      dCompoundStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized CompoundStrategyProxy");
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .initialize(
        addresses.dead,
        cVaultProxy.address,
        assetAddresses.COMP,
        [assetAddresses.DAI],
        [assetAddresses.cDAI]
      )
  );
  log("Initialized CompoundStrategy");
  await withConfirmation(
    cCompoundStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`CompoundStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cCompoundStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for CompoundStrategy");
  }
  return cCompoundStrategy;
};

/**
 *
 *
 */
const deployThreePoolStrategies = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deployWithConfirmation(
    "CurveUSDCStrategyProxy",
    [],
    "ThreePoolStrategyProxy"
  );
  const dCurveUSDCStrategy = await deployWithConfirmation(
    "CurveUSDCStrategy",
    [],
    "ThreePoolStrategy"
  );

  await deployWithConfirmation(
    "CurveUSDTStrategyProxy",
    [],
    "ThreePoolStrategyProxy"
  );
  const dCurveUSDTStrategy = await deployWithConfirmation(
    "CurveUSDTStrategy",
    [],
    "ThreePoolStrategy"
  );

  // Initialize proxies
  const cCurveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const cCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );

  await withConfirmation(
    cCurveUSDCStrategyProxy["initialize(address,address,bytes)"](
      dCurveUSDCStrategy.address,
      await sDeployer.getAddress(),
      []
    )
  );
  log("Initialized CurveUSDCStrategyProxy");

  await withConfirmation(
    cCurveUSDTStrategyProxy["initialize(address,address,bytes)"](
      dCurveUSDTStrategy.address,
      await sDeployer.getAddress(),
      []
    )
  );
  log("Initialized CurveUSDTStrategyProxy");

  // Get contract instances through Proxy
  const cCurveUSDCStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    cCurveUSDCStrategyProxy.address
  );
  const cCurveUSDTStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    cCurveUSDTStrategyProxy.address
  );

  // Initialize Strategies
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await withConfirmation(
    cCurveUSDCStrategy
      .connect(sDeployer)
      ["initialize(address,address,address,address,address,address,address)"](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        assetAddresses.CRV,
        assetAddresses.USDC,
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolGauge,
        assetAddresses.CRVMinter
      )
  );
  log("Initialized CurveUSDCStrategy");

  await withConfirmation(
    cCurveUSDTStrategy
      .connect(sDeployer)
      ["initialize(address,address,address,address,address,address,address)"](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        assetAddresses.CRV,
        assetAddresses.USDT,
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolGauge,
        assetAddresses.CRVMinter
      )
  );
  log("Initialized CurveUSDTStrategy");

  await withConfirmation(
    cCurveUSDCStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`CurveUSDCStrategy transferGovernance(${governorAddr}) called`);

  await withConfirmation(
    cCurveUSDTStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`CurveUSDTStrategy transferGovernance(${governorAddr} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cCurveUSDCStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for CurveUSDCStrategy");

    await withConfirmation(
      cCurveUSDTStrategy.connect(sGovernor).claimGovernance()
    );
    log("Claimed governance for CurveUSDTStrategy");
  }

  return cCurveUSDCStrategy, cCurveUSDTStrategy;
};

/**
 * Configure Vault by adding supported assets and Strategies.
 *
 */
const configureVault = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await ethers.getContractAt(
    "VaultInitializer",
    (await ethers.getContract("VaultProxy")).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (await ethers.getContract("VaultProxy")).address
  );
  // Set up supported assets for Vault
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.DAI)
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDT)
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDC)
  );
  log("Added USDC asset to Vault");
  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on Vault");
};

/**
 * Deploy the MixOracle and initialise it with Chainlink and OpenOracle sources.
 */
const deployOracles = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const oracleAddresses = await getOracleAddresses(deployments);
  log(`Using oracle addresses ${JSON.stringify(oracleAddresses, null, 2)}`);

  // Deploy the Chainlink oracle
  await deployWithConfirmation("ChainlinkOracle", [
    oracleAddresses.chainlink.ETH_USD,
  ]);
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(oracleAddresses.chainlink.DAI_ETH, "DAI", false)
  );
  log("Registered Chainlink feed DAI/ETH");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(oracleAddresses.chainlink.USDC_ETH, "USDC", false)
  );

  log("Registered Chainlink feed USDC/ETH");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(oracleAddresses.chainlink.USDT_ETH, "USDT", false)
  );
  log("Registered Chainlink feed USDT/ETH");

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - for testing the bounds are 1.6 - 0.5
  const maxMinDrift = isMainnetOrRinkebyOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deployWithConfirmation("MixOracle", maxMinDrift);
  const mixOracle = await ethers.getContract("MixOracle");

  // ETH->USD oracles
  await withConfirmation(
    mixOracle.connect(sDeployer).registerEthUsdOracle(chainlinkOracle.address)
  );
  log("Registered uniswap ETH/USD oracle with MixOracle");
  // Token->ETH oracles
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      )
  );
  log("Registered USDC token oracles with MixOracle");
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      )
  );
  log("Registered USDT token oracles with MixOracle");
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      )
  );
  log("Registered DAI token oracles with MixOracle");

  // Governor was set to the deployer address during deployment of the oracles.
  // Update it to the governor address.
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .transferGovernance(await sGovernor.getAddress())
  );
  log("MixOracle transferGovernance called");
  await withConfirmation(mixOracle.connect(sGovernor).claimGovernance());
  log("MixOracle claimGovernance called");
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .transferGovernance(await sGovernor.getAddress())
  );
  log("ChainlinkOracle transferGovernance called");
  await withConfirmation(chainlinkOracle.connect(sGovernor).claimGovernance());
  log("ChainlinkOracle claimGovernance called");
};

/**
 * Deploy the core contracts (Vault and OUSD).
 *
 */
const deployCore = async () => {
  const { governorAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deployWithConfirmation("OUSDProxy");
  await deployWithConfirmation("VaultProxy");
  // Main contracts
  const dOUSD = await deployWithConfirmation("OUSD");
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  await deployWithConfirmation("Governor", [governorAddr, 60]);

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cMixOracle = await ethers.getContract("MixOracle");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault.connect(sGovernor).initialize(cMixOracle.address, cOUSDProxy.address)
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");

  // Initialize OUSD
  await withConfirmation(
    cOUSD
      .connect(sGovernor)
      .initialize("Origin Dollar", "OUSD", cVaultProxy.address)
  );
  log("Initialized OUSD");
};

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployThreePoolStrategies();
  await configureVault();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];

module.exports = main;
