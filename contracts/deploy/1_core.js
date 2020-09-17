const { utils } = require("ethers");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isMainnetOrRinkebyOrFork,
  isRinkeby,
} = require("../test/helpers.js");
const { premiumGasPrice } = require('../utils/gas');

let totalDeployGasUsed = 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += `Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const deployWrapper()

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
  d = await deploy("OUSDProxy", { from: deployerAddr, gasPrice: await premiumGasPrice() });
  log("Deployed OUSDProxy", d);
  d = await deploy("VaultProxy", { from: deployerAddr });
  log("Deployed VaultProxy", d);

  // Deploy core contracts
  const dOUSD = await deploy("OUSD", { from: deployerAddr });
  log("Deployed OUSD", dOUSD);
  const dVault = await deploy("Vault", { from: deployerAddr });
  log("Deployed Vault", dVault);
  d = await deploy("CompoundStrategy", { from: deployerAddr });
  log("Deployed CompoundStrategy", d);
  d = await deploy("Timelock", {
    from: deployerAddr,
    args: [governorAddr, 2 * 24 * 60 * 60],
  });
  log("Deployed Timelock", d);

  // Setup proxies
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");

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

  // Get contract instances
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cCompoundStrategy = await ethers.getContract("CompoundStrategy");

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
  });
  log("Deployed ChainlinkOracle", d);
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
  d = await deploy("OpenUniswapOracle", {
    from: deployerAddr,
    args: [oracleAddresses.openOracle, assetAddresses.WETH],
  });
  log("Deployed OpenUniswapOracle", d);
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
  const MaxMinDrift = isMainnetOrRinkebyOrFork ? [13e7, 7e7] : [16e7, 5e7];
  d = await deploy("MixOracle", { from: deployerAddr, args: MaxMinDrift });
  log("Deployed MixOracle", d);
  const mixOracle = await ethers.getContract("MixOracle");

  // Register the child oracles with the parent MixOracle.
  if (isMainnetOrRinkebyOrFork) {
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

  // Governor was set to the deployer address during deployment of the oracles.
  // Update it to the governor address.
  await mixOracle.connect(sDeployer).transferGovernance(governorAddr);
  log("MixOracle transferGovernance called");
  await mixOracle.connect(sGovernor).claimGovernance();
  log("MixOracle claimGovernance called");

  await chainlinkOracle.connect(sDeployer).transferGovernance(governorAddr);
  log("ChainlinkOracle transferGovernance called");
  await chainlinkOracle.connect(sGovernor).claimGovernance();
  log("ChainlinkOracle claimGovernance called");

  await uniswapOracle.connect(sDeployer).transferGovernance(governorAddr);
  log("UniswapOracle transferGovernance called");
  await uniswapOracle.connect(sGovernor).claimGovernance();
  log("UniswapOracle claimGovernance called");

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

  // Initialize Compound Strategy with supported assets, using Governor signer so Governor is set correctly.
  await cCompoundStrategy
    .connect(sGovernor)
    .initialize(addresses.dead, cVault.address, tokenAddresses, [
      assetAddresses.cDAI,
      assetAddresses.cUSDC,
      assetAddresses.cUSDT,
    ]);
  log("Initialized CompoundStrategy");

  if (isMainnetOrRinkebyOrFork) {
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

  console.log(
    "1_core deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;
