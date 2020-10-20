const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");
const { utils } = require("ethers");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

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

//
// 1. Deploy new Aave strategy for DAI
// 2. Upgrade Curve USDT strategy to fix a bug.
//
const aaveStrategyAnd3PoolUsdtUpgrade = async ({
  getNamedAccounts,
  deployments,
}) => {
  console.log("Running 016_aave_strategy deployment...");

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy the strategy proxy.
  let d = await deploy("AaveStrategyProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
    from: deployerAddr,
    ...(await getTxOpts()),
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed AaveStrategyProxy", d);

  // Deploy the strategy.
  const dAaveStrategy = await deploy("AaveStrategy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dAaveStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed AaveStrategy", dAaveStrategy);

  // Initialize the proxy.
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  let t = await cAaveStrategyProxy["initialize(address,address,bytes)"](
    dAaveStrategy.address,
    governorAddr,
    [],
    await getTxOpts()
  );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized AaveProxy");

  // Initialize the strategy.
  // Note: we are only doing DAI with Aave.
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    cAaveStrategyProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  t = await cAaveStrategy
    .connect(sGovernor)
    .initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      assetAddresses.AAVE,
      [assetAddresses.DAI],
      [assetAddresses.aDAI],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized AaveStrategy");

  // Deploy the new Curve USDT strategy.
  const dCurveUSDTStrategy = await deploy("CurveUSDTStrategy", {
    from: deployerAddr,
    contract: "ThreePoolStrategy",
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDTStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("New curve strategy deployed"); // NOTICE: please upgrade in proposal!

  // Add the Aave strategy to the vault and also upgrade the Curve USDT strategy.
  // NOTICE: If you wish to test the upgrade scripts set TEST_MULTISIG_FORK envariable
  //         Then run the upgradeToCoreAdmin.js script after the deploy
  if (process.env.TEST_MULTISIG_FORK) {
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    const cCurveUSDTStrategyProxy = await ethers.getContract(
      "CurveUSDTStrategyProxy"
    );
    await cCurveUSDTStrategyProxy
      .connect(sGovernor)
      .upgradeTo(dCurveUSDTStrategy.address, await getTxOpts());
    log("Curve USDT strategy upgraded");

    t = await cVault.connect(sGovernor).addStrategy(
      cAaveStrategy.address,
      utils.parseUnits("5", 17), // Set weight to 100%
      await getTxOpts()
    );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Added Aave strategy to vault");
  }

  //
  // On mainnet, initiate a governance transfer to the governor contract (which is the TimeLock).
  // The claimGovernance call will get issued manually via the multi-sig wallet.
  //
  if (isMainnet) {
    const cMinuteTimelock = await ethers.getContract("MinuteTimelock");
    t = await cAaveStrategy
      .connect(sGovernor)
      .transferGovernance(cMinuteTimelock.address, await getTxOpts());
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log(`AaveStrategy transferGovernance(${cMinuteTimelock.address} called`);
  }

  console.log(
    "016_aave_strategy deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

aaveStrategyAnd3PoolUsdtUpgrade.dependencies = ["core"];

module.exports = aaveStrategyAnd3PoolUsdtUpgrade;
