const addresses = require("../utils/addresses");
const { getAssetAddresses, getOracleAddress } = require("../test/helpers.js");

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const {
    deployerAddr,
    proxyAdminAddr,
    governorAddr,
  } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  // Signers
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Proxies
  await deploy("OUSDProxy", { from: deployerAddr });
  await deploy("VaultProxy", { from: deployerAddr });

  // Deploy core contracts
  await deploy("OUSD", { from: deployerAddr });
  await deploy("Vault", { from: deployerAddr });
  await deploy("CompoundStrategy", { from: deployerAddr });
  await deploy("Timelock", {
    from: deployerAddr,
    args: [governorAddr, 3 * 24 * 60 * 60],
  });

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSD = await ethers.getContract("OUSD");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVault = await ethers.getContract("Vault");
  const cCompoundStrategy = await ethers.getContract("CompoundStrategy");

  // Initialize upgradeable contracts
  await cOUSD.initialize("Origin Dollar", "OUSD", cVault.address);

  // Initialize Vault using Governor signer so Governor is set correctly
  await cVault
    .connect(sGovernor)
    .initialize(await getOracleAddress(deployments), cOUSD.address);

  // Need to use function signature when calling initialize due to typed
  // function overloading in Solidity
  await cOUSDProxy["initialize(address,address,bytes)"](
    cOUSD.address,
    proxyAdminAddr,
    []
  );
  await cVaultProxy["initialize(address,address,bytes)"](
    cVault.address,
    proxyAdminAddr,
    []
  );

  // Set up supported assets for Vault
  await cVault.connect(sGovernor).supportAsset(assetAddresses.DAI, "DAI");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDT, "USDT");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.USDC, "USDC");
  await cVault.connect(sGovernor).supportAsset(assetAddresses.TUSD, "TUSD");

  // Initialize Compound Strategy with supported assets
  cCompoundStrategy
    .connect(sGovernor)
    .initialize(
      addresses.dead,
      cVault.address,
      [assetAddresses.DAI, assetAddresses.USDC],
      [assetAddresses.cDAI, assetAddresses.cUSDC]
    );
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
