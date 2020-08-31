const addresses = require("../utils/addresses");
const { getAssetAddresses, getOracleAddress} = require("../test/helpers.js");

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

  // Initialize upgradeable contracts
  await cOUSD
    .connect(sDeployer)
    .initialize("Origin Dollar", "OUSD", cVaultProxy.address);
  // Initialize Vault using Governor signer so Governor is set correctly
  await cVault
    .connect(sGovernor)
    .initialize(await getOracleAddress(deployments), cOUSDProxy.address);
  // Set up supported assets for Vault
  await cVault.connect(sGovernor).supportAsset(assetAddresses.DAI, "DAI");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDT, "USDT");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDC, "USDC");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.TUSD, "TUSD");

  // Unpause deposits
  await cVault.connect(sGovernor).unpauseDeposits();

  // Initialize Compound Strategy with supported assets
  await cCompoundStrategy
    .connect(sGovernor)
    .initialize(
      addresses.dead,
      cVault.address,
      [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
      [assetAddresses.cDAI, assetAddresses.cUSDC, assetAddresses.cUSDT]
    );

  //
  // Deploy Oracles
  //
  console.log("Actually deploying OpenUniswap Oracle");
  console.log("Addresses:", assetAddresses.OpenOracle, assetAddresses.ETH, assetAddresses.USDCETHPair);
  await deploy("OpenUniswapOracle", { from: deployerAddr,
    args:[assetAddresses.OpenOracle, assetAddresses.ETH] });

  const openUniswapOracle = await ethers.getContract("OpenUniswapOracle");
  await openUniswapOracle.connect(sDeployer).registerPair(assetAddresses.USDCETHPair);
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
