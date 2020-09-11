const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddress,
  getChainlinkOracleFeedAddresses,
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
  const feedAddresses = await getChainlinkOracleFeedAddresses(deployments);
  await deploy("ChainlinkOracle", {
    from: deployerAddr,
    // Note: the ChainlinkOracle reads the number of decimals of the ETH feed in its constructor.
    // So it is important to make sure the ETH feed was initialized with the proper number
    // of decimals beforehand.
    args: [feedAddresses.ETH],
  });
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(feedAddresses.DAI, "DAI", false);
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(feedAddresses.USDT, "USDT", false);
  await chainlinkOracle
    .connect(sDeployer)
    .registerFeed(feedAddresses.USDC, "USDC", false);

  // args to the MixOracle of
  // for live the bounds are 1.3 - 0.7
  // fot testing the bounds are 1.6 - 0.5
  const MaxMinDrift = isMainnetOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deploy("MixOracle", { from: deployerAddr, args: MaxMinDrift });
  const mixOracle = await ethers.getContract("MixOracle");
  await mixOracle
    .connect(sDeployer)
    .registerEthUsdOracle(chainlinkOracle.address);
  await mixOracle
    .connect(sDeployer)
    .registerTokenOracles("USDC", [chainlinkOracle.address], []);
  await mixOracle
    .connect(sDeployer)
    .registerTokenOracles("USDT", [chainlinkOracle.address], []);
  await mixOracle
    .connect(sDeployer)
    .registerTokenOracles("DAI", [chainlinkOracle.address], []);

  // Initialize upgradeable contracts
  await cOUSD
    .connect(sDeployer)
    .initialize("Origin Dollar", "OUSD", cVaultProxy.address);
  // Initialize Vault using Governor signer so Governor is set correctly
  await cVault
    .connect(sGovernor)
    .initialize(await getOracleAddress(deployments), cOUSDProxy.address);
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
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
