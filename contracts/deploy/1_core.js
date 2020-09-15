const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnetOrFork,
} = require("../test/helpers.js");

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const {
    deployerAddr,
    proxyAdminAddr,
    governorAddr,
  } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deploy("OUSDProxy", { from: deployerAddr });
  await deploy("VaultProxy", { from: deployerAddr });

  // Deploy core contracts
  const dOUSD = await deploy("OUSD", { from: deployerAddr });
  const dVault = await deploy("Vault", { from: deployerAddr });
  await deploy("CompoundStrategy", { from: deployerAddr });
  await deploy("Timelock", {
    from: deployerAddr,
    args: [governorAddr, 3 * 24 * 60 * 60],
  });

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
  await cVaultProxy["initialize(address,address,bytes)"](
    dVault.address,
    proxyAdminAddr,
    []
  );

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
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.DAI_ETH, "DAI", false);
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.USDC_ETH, "USDC", false);
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(oracleAddresses.chainlink.USDT_ETH, "USDT", false);

  // Deploy then OpenUniSwap oracle.
  let uniswapOracle;
  if (isMainnetOrFork) {
    await deploy("OpenUniswapOracle", {
      from: deployerAddr,
      args: [oracleAddresses.openOracle, assetAddresses.WETH],
    });
    uniswapOracle = await ethers.getContract("OpenUniswapOracle");
    await uniswapOracle
      .connect(sDeployer)
      .registerPair(oracleAddresses.uniswap.DAI_ETH);
    await uniswapOracle
      .connect(sDeployer)
      .registerPair(oracleAddresses.uniswap.USDC_ETH);
    await uniswapOracle
      .connect(sDeployer)
      .registerPair(oracleAddresses.uniswap.USDT_ETH);
  }

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - fot testing the bounds are 1.6 - 0.5
  const MaxMinDrift = isMainnetOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deploy("MixOracle", { from: deployerAddr, args: MaxMinDrift });
  const mixOracle = await ethers.getContract("MixOracle");

  // Register the child oracles with the parent MixOracle.
  // On Mainnet or fork, we register Chainlink and OpenUniswap.
  // On other networks, since we don't have yet an OpenUniswap mock contract, we only register Chainlink.
  if (isMainnetOrFork) {
    // ETH->USD oracles
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(uniswapOracle.address);
    await mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address);
    // Token->ETH oracles
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
    await mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [uniswapOracle.address, chainlinkOracle.address],
        [oracleAddresses.openOracle]
      );
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
  // Initialize Vault using Governor signer so Governor is set correctly
  await cVault
    .connect(sGovernor)
    .initialize(mixOracle.address, cOUSDProxy.address);
  // Set up supported assets for Vault
  await cVault.connect(sGovernor).supportAsset(assetAddresses.DAI);
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDT);
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDC);

  // Unpause deposits
  await cVault.connect(sGovernor).unpauseDeposits();

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

  if (isMainnetOrFork) {
    // Set 0.5% withdrawal fee.
    await cVault.connect(sGovernor).setRedeemFeeBps(50);

    // Add the compound strategy to the vault with a target weight of 100%.
    await cVault.connect(sGovernor).addStrategy(cCompoundStrategy.address, 100);
  }

  return true;
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
