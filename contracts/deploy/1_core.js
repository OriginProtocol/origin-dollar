const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isMainnetOrFork,
} = require("../test/helpers.js");
const { utils } = require("ethers");

function log(msg) {
  if (isMainnet) {
    console.log("INFO:", msg);
  }
}

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const {
    deployerAddr,
    proxyAdminAddr,
    governorAddr,
  } = await getNamedAccounts();

  log("Running 1_core deployment...");

  const assetAddresses = await getAssetAddresses(deployments);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deploy("OUSDProxy", { from: deployerAddr });
  log("Deployed OUSDProxy");
  await deploy("VaultProxy", { from: deployerAddr });
  log("Deployed VaultProxy");

  // Deploy core contracts
  const dOUSD = await deploy("OUSD", { from: deployerAddr });
  log("Deployed OUSD");
  const dVault = await deploy("Vault", { from: deployerAddr });
  log("Deployed Vault");
  await deploy("CompoundStrategy", { from: deployerAddr });
  log("Deployed CompoundStrategy");
  await deploy("Timelock", {
    from: deployerAddr,
    args: [governorAddr, 2 * 24 * 60 * 60],
  });
  log("Deployed CompoundStrategy");

  // Setup proxies
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  // Need to use function signature when calling initialize due to typed
  // function overloading in Solidity
  await cOUSDProxy["initialize(address,address,bytes)"](
    dOUSD.address,
    proxyAdminAddr,
    []
  );
  log("Deployed CompoundStrategy");
  await cVaultProxy["initialize(address,address,bytes)"](
    dVault.address,
    proxyAdminAddr,
    []
  );
  log("Deployed CompoundStrategy");

  // Get contract instances
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cCompoundStrategy = await ethers.getContract("CompoundStrategy");

  //
  // Deploy Oracles
  //
  const oracleAddresses = await getOracleAddresses(deployments);

  // Deploy the chainlink oracle.
  await deploy("ChainlinkOracle", {
    from: deployerAddr,
    // Note: the ChainlinkOracle reads the number of decimals of the ETH feed in its constructor.
    // So it is important to make sure the ETH feed was initialized with the proper number
    // of decimals beforehand.
    args: [oracleAddresses.chainlink.ETH_USD],
  });
  log("Deployed ChainlinkOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.DAI_ETH, "DAI", false);
  log("Registered chainink feed DAI/ETH");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.USDC_ETH, "USDC", false);
  log("Registered chainink feed USDC/ETH");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.USDT_ETH, "USDT", false);
  log("Registered chainink feed USDT/ETH");

  // Deploy the OpenUniswap oracle.
  await deploy("OpenUniswapOracle", {
    from: deployerAddr,
    args: [oracleAddresses.openOracle, assetAddresses.WETH],
  });
  log("Deployed OpenUniswapOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.DAI_ETH);
  log("Registered uniswap pair DAI/ETH");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDC_ETH);
  log("Registered uniswap pair USDC/ETH");
  await uniswapOracle
    .connect(sDeployer)
    .registerPair(oracleAddresses.uniswap.USDT_ETH);
  log("Registered uniswap pair USDT/ETH");

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - fot testing the bounds are 1.6 - 0.5
  const MaxMinDrift = isMainnetOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deploy("MixOracle", { from: deployerAddr, args: MaxMinDrift });
  log("Deployed MixOracle");
  const mixOracle = await ethers.getContract("MixOracle");

  // Register the child oracles with the parent MixOracle.
  if (isMainnetOrFork) {
    // ETH->USD oracles
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(uniswapOracle.address);
    log("Registered uniswap ETH/USD oracle with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address);
    log("Registered chainlink ETH/USD oracle with MixOracle");
    // Token->ETH oracles
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    log("Registered USDC token oracles with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    log("Registered USDT token oracles with MixOracle");
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    log("Registered DAI token oracles with MixOracle");
  } else {
    // ETH->USD oracles
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address);
    // Token->ETH oracles
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
  }

  // Initialize upgradeable contracts
  await cOUSD
    .connect(sDeployer)
    .initialize("Origin Dollar", "OUSD", cVaultProxy.address);
  log("Initialized OUSD");
  // Initialize Vault using Governor signer so Governor is set correctly
  await cVault
    .connect(sGovernor)
    .initialize(mixOracle.address, cOUSDProxy.address);
  log("Initialized Vault");
  // Set up supported assets for Vault
  await cVault.connect(sGovernor).supportAsset(assetAddresses.DAI);
  log("Added DAI asset to Vault");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDT);
  log("Added USDT asset to Vault");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDC);
  log("Added USDC asset to Vault");

  // Unpause deposits
  await cVault.connect(sGovernor).unpauseDeposits();
  log("Unpaused deposits on Vault");

  const tokenAddresses = [
    assetAddresses.DAI,
    assetAddresses.USDC,
    assetAddresses.USDT,
  ];

  // Initialize Compound Strategy with supported assets
  await cCompoundStrategy
    .connect(sGovernor)
    .initialize(addresses.dead, cVault.address, tokenAddresses, [
      assetAddresses.cDAI,
      assetAddresses.cUSDC,
      assetAddresses.cUSDT,
    ]);
  log("Initialized CompoundStrategy");

  if (isMainnetOrFork) {
    // Set 0.5% withdrawal fee.
    await cVault.connect(sGovernor).setRedeemFeeBps(50);
    log("Set redeem fee on Vault");

    // Set liquidity buffer to 10% (0.1 with 18 decimals = 1e17).
    await cVault.connect(sGovernor).setVaultBuffer(utils.parseUnits("1", 17));
    log("Set buffer on Vault");

    // Add the compound strategy to the vault with a target weight of 100% (1.0 with 18 decimals=1e18).
    await cVault
      .connect(sGovernor)
      .addStrategy(cCompoundStrategy.address, utils.parseUnits("1", 18));
    log("Added compound strategy to vault");
  }

  return true;
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
