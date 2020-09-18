const { utils } = require("ethers");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isMainnetOrRinkebyOrFork,
  isRinkeby,
} = require("../test/helpers.js");
const { premiumGasPrice } = require("../utils/gas");

let totalDeployGasUsed = 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

// Returns extra options to use when sending a tx to the network.
// See https://buidler.dev/plugins/buidler-deploy.html for available options.
async function getTxOpts() {
  if (process.env.PREMIUM_GAS) {
    const gasPrice = await premiumGasPrice(process.env.PREMIUM_GAS);
    return { gasPrice };
  }
  return {};
}

const deployCore = async ({ getNamedAccounts, deployments }) => {
  let d;
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  console.log("Running 1_core deployment...");

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  d = await deploy("OUSDProxy", { from: deployerAddr, ...(await getTxOpts()) });
  log("Deployed OUSDProxy", d);
  d = await deploy("VaultProxy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  log("Deployed VaultProxy", d);
  await deploy("CompoundStrategyProxy", { from: deployerAddr });

  // Deploy core contracts
  const dOUSD = await deploy("OUSD", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  log("Deployed OUSD", dOUSD);
  const dVault = await deploy("Vault", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  log("Deployed Vault", dVault);
  const dCompoundStrategy = await deploy("CompoundStrategy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  log("Deployed CompoundStrategy", dCompoundStrategy);
  d = await deploy("Timelock", {
    from: deployerAddr,
    args: [governorAddr, 2 * 24 * 60 * 60],
    ...(await getTxOpts()),
  });
  log("Deployed Timelock", d);

  // Setup proxies
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  // Need to use function signature when calling initialize due to typed
  // function overloading in Solidity
  await cOUSDProxy["initialize(address,address,bytes)"](
    dOUSD.address,
    governorAddr,
    []
  );
  log("Initialized OUSDProxy");
  await cVaultProxy["initialize(address,address,bytes)"](
    dVault.address,
    governorAddr,
    []
  );
  log("Initialized VaultProxy");
  await cCompoundStrategyProxy["initialize(address,address,bytes)"](
    dCompoundStrategy.address,
    governorAddr,
    []
  );
  log("Initialized CompoundProxy");

  // Get contract instances
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  //
  // Deploy Oracles
  //
  const oracleAddresses = await getOracleAddresses(deployments);
  log(`Using oracle addresses ${JSON.stringify(oracleAddresses, null, 2)}`);

  // Deploy the chainlink oracle.
  d = await deploy("ChainlinkOracle", {
    from: deployerAddr,
    // Note: the ChainlinkOracle reads the number of decimals of the ETH feed in its constructor.
    // So it is important to make sure the ETH feed was initialized with the proper number
    // of decimals beforehand.
    args: [oracleAddresses.chainlink.ETH_USD],
    ...(await getTxOpts()),
  });
  log("Deployed ChainlinkOracle", d);
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(
      oracleAddresses.chainlink.DAI_ETH,
      "DAI",
      false,
      await getTxOpts()
    );
  log("Registered chainink feed DAI/ETH");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(
      oracleAddresses.chainlink.USDC_ETH,
      "USDC",
      false,
      await getTxOpts()
    );
  log("Registered chainink feed USDC/ETH");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(
      oracleAddresses.chainlink.USDT_ETH,
      "USDT",
      false,
      await getTxOpts()
    );
  log("Registered chainink feed USDT/ETH");

  // Deploy the OpenUniswap oracle.
  d = await deploy("OpenUniswapOracle", {
    from: deployerAddr,
    args: [oracleAddresses.openOracle, assetAddresses.WETH],
    ...(await getTxOpts()),
  });
  log("Deployed OpenUniswapOracle", d);
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.DAI_ETH, await getTxOpts());
  log("Registered uniswap pair DAI/ETH");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDC_ETH, await getTxOpts());
  log("Registered uniswap pair USDC/ETH");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDT_ETH, await getTxOpts());
  log("Registered uniswap pair USDT/ETH");

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - fot testing the bounds are 1.6 - 0.5
  const MaxMinDrift = isMainnetOrRinkebyOrFork ? [13e7, 7e7] : [16e7, 5e7];
  d = await deploy("MixOracle", {
    from: deployerAddr,
    args: MaxMinDrift,
    ...(await getTxOpts()),
  });
  log("Deployed MixOracle", d);
  const mixOracle = await ethers.getContract("MixOracle");

  // Register the child oracles with the parent MixOracle.
  if (isMainnetOrRinkebyOrFork) {
    // ETH->USD oracles
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(uniswapOracle.address, await getTxOpts());
    log("Registered uniswap ETH/USD oracle with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts());
    log("Registered chainlink ETH/USD oracle with MixOracle");
    // Token->ETH oracles
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    log("Registered USDC token oracles with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    log("Registered USDT token oracles with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    log("Registered DAI token oracles with MixOracle");
  } else {
    // ETH->USD oracles
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts());
    // Token->ETH oracles
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      );
  }

  // Governor was set to the deployer address during deployment of the oracles.
  // Update it to the governor address.
  await mixOracle
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  log("MixOracle transferGovernance called");
  await mixOracle.connect(sGovernor).claimGovernance(await getTxOpts());
  log("MixOracle claimGovernance called");

  await chainlinkOracle
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  log("ChainlinkOracle transferGovernance called");
  await chainlinkOracle.connect(sGovernor).claimGovernance(await getTxOpts());
  log("ChainlinkOracle claimGovernance called");

  await uniswapOracle
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  log("UniswapOracle transferGovernance called");
  await uniswapOracle.connect(sGovernor).claimGovernance(await getTxOpts());
  log("UniswapOracle claimGovernance called");

  // Initialize upgradeable contracts: OUSD and Vault.
  await cOUSD
    .connect(sGovernor)
    .initialize(
      "Origin Dollar",
      "OUSD",
      cVaultProxy.address,
      await getTxOpts()
    );
  log("Initialized OUSD");
  await cVault
    .connect(sGovernor)
    .initialize(mixOracle.address, cOUSDProxy.address, await getTxOpts());
  log("Initialized Vault");
  // Set up supported assets for Vault
  await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.DAI, await getTxOpts());
  log("Added DAI asset to Vault");
  await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.USDT, await getTxOpts());
  log("Added USDT asset to Vault");
  await cVault
    .connect(sGovernor)
    .supportAsset(assetAddresses.USDC, await getTxOpts());
  log("Added USDC asset to Vault");

  // Unpause deposits
  await cVault.connect(sGovernor).unpauseDeposits(await getTxOpts());
  log("Unpaused deposits on Vault");

  const tokenAddresses = [
    assetAddresses.DAI,
    assetAddresses.USDC,
    assetAddresses.USDT,
  ];

  // Initialize Compound Strategy with supported assets, using Governor signer so Governor is set correctly.
  await cCompoundStrategy
    .connect(sGovernor)
    .initialize(
      addresses.dead,
      cVault.address,
      tokenAddresses,
      [assetAddresses.cDAI, assetAddresses.cUSDC, assetAddresses.cUSDT],
      await getTxOpts()
    );
  log("Initialized CompoundStrategy");

  if (isMainnetOrRinkebyOrFork) {
    // Set 0.5% withdrawal fee.
    await cVault.connect(sGovernor).setRedeemFeeBps(50, await getTxOpts());
    log("Set redeem fee on Vault");

    // Set liquidity buffer to 10% (0.1 with 18 decimals = 1e17).
    await cVault
      .connect(sGovernor)
      .setVaultBuffer(utils.parseUnits("1", 17), await getTxOpts());
    log("Set buffer on Vault");

    // Add the compound strategy to the vault with a target weight of 100% (1.0 with 18 decimals=1e18).
    await cVault
      .connect(sGovernor)
      .addStrategy(
        cCompoundStrategy.address,
        utils.parseUnits("1", 18),
        await getTxOpts()
      );
    log("Added compound strategy to vault");

    // For the initial testing period, set the auto-allocate threshold to $5 (using 18 decimals).
    await cVault
      .connect(sGovernor)
      .setAutoAllocateThreshold(utils.parseUnits("5", 18));
    log("Auto-allocate threshold set to $5");
  }

  console.log(
    "1_core deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
