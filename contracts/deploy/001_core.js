const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

console.log(hre);

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
 * Deploy Compound Strategy which only supports DAI.
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

  const dAaveStrategyProxy = await deployWithConfirmation("AaveStrategyProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
  });
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    dAaveStrategyProxy.address
  );
  await withConfirmation(
    await cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      deployerAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized AaveStrategyProxy");
  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      .initialize(
        assetAddresses.AAVE_ADDRESS_PROVIDER,
        cVaultProxy.address,
        assetAddresses.AAVE,
        [assetAddresses.DAI],
        [assetAddresses.aDAI],
        await getTxOpts()
      )
  );
  log("Initialized AaveStrategy");
  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      .transferGovernance(strategyGovernorAddress, await getTxOpts())
  );
  log(`AaveStrategy transferGovernance(${strategyGovernorAddress} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cAaveStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
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
  const assetAddresses = await hre.getAssetAddresses(deployments);
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
      await sGovernor.getAddress(),
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
        [assetAddresses.cDAI],
        await getTxOpts()
      )
  );
  log("Initialized CompoundStrategy");
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .transferGovernance(strategyGovernorAddress, await getTxOpts())
  );
  log(`CompoundStrategy transferGovernance(${strategyGovernorAddress} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cCompoundStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
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
  const strategyGovernorAddress = await getStrategyGovernorAddress();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const dCurveUSDCStrategyProxy = await deployWithConfirmation(
    "CurveUSDCStrategyProxy",
    { contract: "ThreePoolStrategyProxy" }
  );
  log("Deployed CurveUSDCStrategyProxy", dCurveUSDCStrategyProxy);
  const dCurveUSDCStrategy = await deployWithConfirmation("CurveUSDCStrategy", {
    contract: "ThreePoolStrategy",
  });

  const dCurveUSDTStrategyProxy = await deployWithConfirmation(
    "CurveUSDTStrategyProxy",
    { contract: "ThreePoolStrategyProxy" }
  );
  log("Deployed CurveUSDTStrategyProxy", dCurveUSDTStrategyProxy);
  const dCurveUSDTStrategy = await deployWithConfirmation("CurveUSDTStrategy", {
    contract: "ThreePoolStrategy",
  });

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
      [],
      await getTxOpts()
    )
  );
  log("Initialized CurveUSDCStrategyProxy");

  await withConfirmation(
    cCurveUSDTStrategyProxy["initialize(address,address,bytes)"](
      dCurveUSDTStrategy.address,
      await sDeployer.getAddress(),
      [],
      await getTxOpts()
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
        assetAddresses.CRVMinter,
        await getTxOpts()
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
        assetAddresses.CRVMinter,
        await getTxOpts()
      )
  );
  log("Initialized CurveUSDTStrategy");

  await withConfirmation(
    cCurveUSDCStrategy
      .connect(sDeployer)
      .transferGovernance(strategyGovernorAddress, await getTxOpts())
  );
  log(
    `CurveUSDCStrategy transferGovernance(${strategyGovernorAddress}) called`
  );

  await withConfirmation(
    cCurveUSDTStrategy
      .connect(sDeployer)
      .transferGovernance(strategyGovernorAddress, await getTxOpts())
  );
  log(`CurveUSDTStrategy transferGovernance(${strategyGovernorAddress} called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cCurveUSDCStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
    );
    log("Claimed governance for CurveUSDCStrategy");

    await withConfirmation(
      cCurveUSDTStrategy.connect(sGovernor).claimGovernance(await getTxOpts())
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

  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (await ethers.getContract("VaultProxy")).address
  );
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cMixOracle = await ethers.getContract("MixOracle");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .initialize(cMixOracle.address, cOUSDProxy.address, await getTxOpts())
  );
  log("Initialized Vault");

  // Set up supported assets for Vault
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .supportAsset(assetAddresses.DAI, await getTxOpts())
  );
  log("Added DAI asset to Vault");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .supportAsset(assetAddresses.USDT, await getTxOpts())
  );
  log("Added USDT asset to Vault");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .supportAsset(assetAddresses.USDC, await getTxOpts())
  );
  log("Added USDC asset to Vault");

  // Unpause deposits
  await withConfirmation(
    cVault.connect(sGovernor).unpauseDeposits(await getTxOpts())
  );
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
  deployWithConfirmation("ChainlinkOracle", [
    oracleAddresses.chainlink.ETH_USD,
  ]);
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.DAI_ETH,
        "DAI",
        false,
        await getTxOpts()
      )
  );
  log("Registered Chainlink feed DAI/ETH");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.USDC_ETH,
        "USDC",
        false,
        await getTxOpts()
      )
  );

  log("Registered Chainlink feed USDC/ETH");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.USDT_ETH,
        "USDT",
        false,
        await getTxOpts()
      )
  );
  log("Registered Chainlink feed USDT/ETH");

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - fot testing the bounds are 1.6 - 0.5
  const maxMinDrift = isMainnetOrRinkebyOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deployWithConfirmation("MixOracle", [maxMinDrift]);
  const mixOracle = await ethers.getContract("MixOracle");

  // ETH->USD oracles
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts())
  );
  log("Registered uniswap ETH/USD oracle with MixOracle");
  // Token->ETH oracles
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered USDC token oracles with MixOracle");
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered USDT token oracles with MixOracle");
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered DAI token oracles with MixOracle");

  // Governor was set to the deployer address during deployment of the oracles.
  // Update it to the governor address.
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .transferGovernance(await sGovernor.getAddress(), await getTxOpts())
  );
  log("MixOracle transferGovernance called");
  withConfirmation(
    mixOracle.connect(sGovernor).claimGovernance(await getTxOpts())
  );
  log("MixOracle claimGovernance called");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .transferGovernance(await sGovernor.getAddress(), await getTxOpts())
  );
  log("ChainlinkOracle transferGovernance called");
  withConfirmation(
    chainlinkOracle.connect(sGovernor).claimGovernance(await getTxOpts())
  );
  log("ChainlinkOracle claimGovernance called");
};

/**
 * Deploy the core contracts (Vault and OUSD).
 *
 */
const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  console.log("Running 001_core deployment...");

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Main contracts
  const dOUSD = deployWithConfirmation("OUSD");
  const dVaultCore = deployWithConfirmation("VaultCore");
  const dVaultAdmin = deployWithConfirmation("VaultAdmin");
  const dRebaseHooks = deployWithConfirmation("RebaseHooks");
  // Timelock and governance
  const dMinuteTimelock = deployWithConfirmation("MinuteTimelock");
  const dGovernor = await deploy("Governor", [
    dMinuteTimelock.address,
    governorAddr,
  ]);
  const cMinuteTimelock = await ethers.getContract("MinuteTimelock");
  withConfirmation(
    cMinuteTimelock.connect(sDeployer).initialize(dGovernor.address)
  );
  deployWithConfirmation("Timelock", [governorAddr, 2 * 24 * 60 * 60]);

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultCore = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cRebaseHooks = await ethers.getContractAt(
    "RebaseHooks",
    dRebaseHooks.address
  );
  const cVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVaultCore.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");
  await withConfirmation(
    cVaultCore
      .connect(sGovernor)
      .setAdminImpl(dVaultAdmin.address, await getTxOpts())
  );
  log("Initialized Vault admin implementation");
  await withConfirmation(
    cVaultAdmin.connect(sGovernor).setRebaseHooksAddr(cRebaseHooks.address)
  );
  log("Set RebaseHooks address on Vault");

  // Initialize OUSD
  await withConfirmation(
    cOUSD
      .connect(sGovernor)
      .initialize(
        "Origin Dollar",
        "OUSD",
        cVaultProxy.address,
        await getTxOpts()
      )
  );
  log("Initialized OUSD");

  console.log(
    "001_core deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

const main = async () => {
  await deployCore();
  await deployOracles();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployThreePoolStrategies();
  await configureVault();
};

main.id = "001";
main.dependencies = ["mocks"];

module.exports = main;
