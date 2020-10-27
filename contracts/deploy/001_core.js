const { utils } = require("ethers");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

let totalDeployGasUsed = 0;

const getStrategyGovernorAddress = async () => {
  if (isMainnet) {
    // On Mainnet the governor is the TimeLock
    return (await ethers.getContract("MinuteTimelock")).address;
  } else {
    return governorAddr;
  }
}

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const dAaveStrategyProxy = await deployWithConfirmation("AaveStrategyProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
  });
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  withConfirmation(await cAaveStrategyProxy["initialize(address,address,bytes)"](
    dAaveStrategy.address,
    deployerAddr,
    [],
    await getTxOpts()
  ));
  log("Initialized AaveStrategyProxy");
  withConfirmation(cAaveStrategy
    .connect(sDeployer)
    .initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      assetAddresses.AAVE,
      [assetAddresses.DAI],
      [assetAddresses.aDAI],
      await getTxOpts()
    ))
  log("Initialized AaveStrategy");
  withConfirmation(cAaveStrategy
    .connect(sDeployer)
    .transferGovernance(await getStrategyGovernorAddress(), await getTxOpts()))
  log(`AaveStrategy transferGovernance(${strategyGovAddr} called`);
  // Claim governance if not on mainnet
  if (!isMainnet) {
    withConfirmation(cAaveStrategy
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance(await getTxOpts()));
    log("Claimed governance for AaveStrategy");
  }
}

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundStrategy = async () => {
  const dCompoundStrategyProxy = await deployWithConfirmation(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    dCompoundStrategyProxy.address
  );
  withConfirmation(cCompoundStrategyProxy["initialize(address,address,bytes)"](
    dCompoundStrategy.address,
    governorAddr,
    []
  ));
  log("Initialized CompoundStrategyProxy");
  withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .initialize(
        addresses.dead,
        cVault.address,
        assetAddresses.COMP,
        [assetAddresses.DAI],
        [assetAddresses.cDAI],
        await getTxOpts()
      )
  );
  log("Initialized CompoundStrategy");
  return cCompoundStrategy
}

/**
 *
 *
 */
const deployThreePoolStrategies = () => {
}

/**
 * Configure vault
 *
 */
const configureVault = () => {
}

/**
 *
 *
 */
const deployOracles = () => {
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
  deployWithConfirmation("MixOracle", [maxMinDrift]);
  const mixOracle = await ethers.getContract("MixOracle");

  // Register the child oracles with the parent MixOracle.
  if (isMainnetOrRinkebyOrFork) {
    withConfirmation(
      await mixOracle
        .connect(sDeployer)
        .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts())
    );
    log("Registered uniswap ETH/USD oracle with MixOracle");

    withConfirmation(
      await mixOracle
        .connect(sDeployer)
        .registerTokenOracles(
          "USDC",
          [uniswapOracle.address, chainlinkOracle.address],
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
          [uniswapOracle.address, chainlinkOracle.address],
          [oracleAddresses.openOracle],
          await getTxOpts()
        )
    );
    log("Registered USDT token oracles with MixOracle");

    t = await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);

    log("Registered DAI token oracles with MixOracle");
  } else {
    // ETH->USD oracles
    t = await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts());
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    // Token->ETH oracles
    t = await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    t = await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    t = await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  }

  // Governor was set to the deployer address during deployment of the oracles.
  // Update it to the governor address.
  withConfirmation(
    mixOracle
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log("MixOracle transferGovernance called");
  withConfirmation(
    mixOracle.connect(sGovernor).claimGovernance(await getTxOpts())
  );
  log("MixOracle claimGovernance called");
  withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log("ChainlinkOracle transferGovernance called");
  withConfirmation(
    chainlinkOracle.connect(sGovernor).claimGovernance(await getTxOpts())
  );
  log("ChainlinkOracle claimGovernance called");

  t = await uniswapOracle
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("UniswapOracle transferGovernance called");

  t = await uniswapOracle.connect(sGovernor).claimGovernance(await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("UniswapOracle claimGovernance called");
}

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  console.log("Running 001_core deployment...");

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const dOUSDProxy = await deployWithConfirmation("OUSDProxy");
  const dVaultProxy = await deployWithConfirmation("VaultProxy");
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
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cRebaseHooks = await ethers.getContractAt(
    "RebaseHooks",
    dRebaseHooks.address
  );
  const cVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );
  // Need to use function signature when calling initialize due to typed
  // function overloading in Solidity
  withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");
  withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVaultCore.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");
  withConfirmation(
    await cVaultCore
      .connect(sGovernor)
      .setAdminImpl(dVaultAdmin.address, await getTxOpts())
  );
  withConfirmation(
    await cVaultAdmin
      .connect(sGovernor)
      .setRebaseHooksAddr(cRebaseHooks.address)
  );
  log("Set RebaseHooks address on Vault");

  // Initialize upgradeable contracts: OUSD and Vault.
  t = await cOUSD
    .connect(sGovernor)
    .initialize(
      "Origin Dollar",
      "OUSD",
      cVaultProxy.address,
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized OUSD");

  t = await cVault
    .connect(sGovernor)
    .initialize(mixOracle.address, cOUSDProxy.address, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized Vault");

  // Set up supported assets for Vault
  t = await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.DAI, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Added DAI asset to Vault");

  t = await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.USDT, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Added USDT asset to Vault");
  t = await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.USDC, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Added USDC asset to Vault");

  // Unpause deposits
  t = await cVault.connect(sGovernor).unpauseDeposits(await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Unpaused deposits on Vault");

  if (isMainnetOrRinkebyOrFork) {
    // Set 0.5% withdrawal fee.
    withConfirmation(
      cVault.connect(sGovernor).setRedeemFeeBps(50, await getTxOpts())
    );
    log("Set redeem fee on Vault");
    // Set liquidity buffer to 2% (0.02 with 18 decimals = 2e16).
    t = withConfirmation(
      cVault
        .connect(sGovernor)
        .setVaultBuffer(utils.parseUnits("2", 16), await getTxOpts())
    );
    log("Set buffer on Vault");
    // Add the compound strategy to the vault with a target weight of 100% (1.0 with 18 decimals=1e18).
    withConfirmation(
      cVault
        .connect(sGovernor)
        .addStrategy(
          cCompoundStrategy.address,
          utils.parseUnits("5", 17),
          await getTxOpts()
        )
    );
    log("Added Compound strategy to vault");
  }

  console.log(
    "001_core deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

deployCore.id = "001";
deployCore.dependencies = ["mocks"];

module.exports = deployCore;
