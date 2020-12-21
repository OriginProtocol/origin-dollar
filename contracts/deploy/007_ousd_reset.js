const hre = require("hardhat");
const { utils } = require("ethers");

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

const getStrategyGovernorAddress = async () => {
  const { governorAddr } = await hre.getNamedAccounts();
  if (isMainnet) {
    // On Mainnet the governor is the TimeLock
    return (await ethers.getContract("MinuteTimelock")).address;
  } else {
    return governorAddr;
  }
};

/**
 * Deploy AAVE Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const strategyGovernorAddress = await getStrategyGovernorAddress();
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
    cAaveStrategy.connect(sDeployer).transferGovernance(strategyGovernorAddress)
  );
  log(`AaveStrategy transferGovernance(${strategyGovernorAddress} called`);

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
  const strategyGovernorAddress = await getStrategyGovernorAddress();
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
        [assetAddresses.USDC, assetAddresses.USDT],
        [assetAddresses.cUSDC, assetAddresses.cUSDT]
      )
  );
  log("Initialized CompoundStrategy");
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .transferGovernance(strategyGovernorAddress)
  );
  log(`CompoundStrategy transferGovernance(${strategyGovernorAddress} called`);

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
  log("Deployed MixOracle");

  // ETH->USD oracles
  await withConfirmation(
    mixOracle.connect(sDeployer).registerEthUsdOracle(chainlinkOracle.address)
  );
  log("Registered ETH USD oracle with MixOracle");

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
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .transferGovernance(await sGovernor.getAddress())
  );
  log("ChainlinkOracle transferGovernance called");

  // On mainnet the following steps need to be made by the multisig governor
  if (!isMainnet) {
    await withConfirmation(mixOracle.connect(sGovernor).claimGovernance());
    log("MixOracle claimGovernance called");
    await withConfirmation(
      chainlinkOracle.connect(sGovernor).claimGovernance()
    );
    log("ChainlinkOracle claimGovernance called");
  }
};

const deployVault = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  let cVaultProxy = await ethers.getContract("VaultProxy");

  // Proxy
  const dVaultProxy = await deployWithConfirmation("VaultProxy");
  log("Deployed Vault proxy", dVaultProxy.address);

  // Main contracts
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  log("Deployed Vault contracts");

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  cVaultProxy = await ethers.getContract("VaultProxy");
  const cMixOracle = await ethers.getContract("MixOracle");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      deployerAddr,
      []
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault.connect(sDeployer).initialize(cMixOracle.address, cOUSDProxy.address)
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy.connect(sDeployer).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sDeployer).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");
};

const upgradeAndResetOUSD = async () => {
  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Temporary OUSD for running a reset
  const dOUSDReset = await deployWithConfirmation("OUSDReset");
  // Main OUSD
  const dOUSD = await deployWithConfirmation("OUSD");

  const cOUSDProxy = await ethers.getContract("OUSDProxy");

  // On mainnet the following steps need to be made by the multisig governor
  if (!isMainnet) {
    await withConfirmation(
      cOUSDProxy.connect(sGovernor).upgradeTo(dOUSDReset.address)
    );
    log("Upgraded OUSD to reset implementation");

    const cOUSDReset = await ethers.getContractAt(
      "OUSDReset",
      cOUSDProxy.address
    );
    const cVaultProxy = await ethers.getContract("VaultProxy");
    await withConfirmation(
      cOUSDReset.connect(sGovernor).setVaultAddress(cVaultProxy.address)
    );
    await withConfirmation(cOUSDReset.connect(sGovernor).reset());
    log("Called reset on OUSD");

    await withConfirmation(
      cOUSDProxy.connect(sGovernor).upgradeTo(dOUSD.address)
    );
    log("Upgraded OUSD to standard implementation");
  }
};

const configureVault = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (await ethers.getContract("VaultProxy")).address
  );

  // Set Uniswap addr
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setUniswapAddr("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")
  );

  // Set strategist addr
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setStrategistAddr("0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC")
  );

  // Set Vault buffer
  await withConfirmation(
    cVault.connect(sDeployer).setVaultBuffer(utils.parseUnits("2", 16))
  );

  // Set Redeem fee BPS
  await withConfirmation(cVault.connect(sDeployer).setRedeemFeeBps(50));

  // Set up supported assets for Vault
  await withConfirmation(
    cVault.connect(sDeployer).supportAsset(assetAddresses.DAI)
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault.connect(sDeployer).supportAsset(assetAddresses.USDT)
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault.connect(sDeployer).supportAsset(assetAddresses.USDC)
  );
  log("Added USDC asset to Vault");

  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  // Approve strategies
  await withConfirmation(
    cVault.connect(sDeployer).approveStrategy(cAaveStrategyProxy.address)
  );
  await withConfirmation(
    cVault.connect(sDeployer).approveStrategy(cCompoundStrategyProxy.address)
  );

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(assetAddresses.DAI, cAaveStrategyProxy.address)
  );

  // Set up the default strategy for each asset
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        assetAddresses.USDC,
        cCompoundStrategyProxy.address
      )
  );
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        assetAddresses.USDT,
        cCompoundStrategyProxy.address
      )
  );

  // Finally transfer Governance to the governor address from the deployer
  await withConfirmation(
    cVault.connect(sDeployer).transferGovernance(governorAddr)
  );

  if (!isMainnet) {
    await withConfirmation(cVault.connect(sGovernor).claimGovernance());
  }
};

// Multisig requirements for mainnet
//
// - AaveStrategy claimGovernance()
// - CompoundStrategy claimGovernance()
// - MixOracle claimGovernance()
// - ChainlinkOracle claimGovernance()
// - Vault claimGovernance()
//
// - OUSD transferGovernance to new governor
// - OUSD claimGovernance
// - OUSDProxy upgradeTo OUSDReset
// - OUSDReset reset()
// - OUSDProxy upgradeTo OUSD

const main = async () => {
  console.log("Running 007_ousd_reset deployment...");
  await deployOracles();
  await deployVault();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await configureVault();
  await upgradeAndResetOUSD();
  console.log("007_ousd_reset deploy done.");
  return true;
};

main.id = "007_ousd_reset";
main.dependencies = ["002_upgrade_vault", "003_governor"];
main.skip = () => !isMainnetOrRinkebyOrFork;

module.exports = main;
