const { getAssetAddresses, isMainnet, isRinkeby } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

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

const aaveStrategy = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const assetAddresses = await getAssetAddresses(deployments);

  console.log("Running 11_aave_strategy deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  // Deploy the aave strategy proxy
  d = await deploy("AaveStrategyProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
    from: deployerAddr,
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed AaveStrategyProxy", d);

  const dAaveStrategy = await deploy("AaveStrategy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dAaveStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed AaveStrategy", dAaveStrategy);

  const cAaveStrategyProxy = await ethers.getContract(
    "AaveStrategyProxy"
  );

  let t = await cAaveStrategyProxy["initialize(address,address,bytes)"](
    dAaveStrategy.address,
    governorAddr,
    []
  );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized AaveProxy");

  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    cAaveStrategyProxy.address
  );

  const tokenAddresses = [
    assetAddresses.DAI,
    assetAddresses.USDC,
    assetAddresses.USDT,
  ];

  const cVaultProxy = await ethers.getContract("VaultProxy");

  t = await cAaveStrategy
    .connect(sGovernor)
    .initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      assetAddresses.AAVE,
      tokenAddresses,
      [assetAddresses.aDAI, assetAddresses.aUSDC, assetAddresses.aUSDT],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized AaveStrategy");

  // NOTICE: If you wish to test the upgrade scripts set TEST_MULTISIG_UPGRADE envariable
  //         Then run the upgradeToCoreAdmin.js script after the deploy
  if (!isMainnet && !isRinkeby && !process.env.TEST_MULTISIG_UPGRADE) {
    // On mainnet these transactions must be executed by governor multisig

  } else {
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    t = await cVault
      .connect(sGovernor)
      .addStrategy(
        cAaveStrategy.address,
        utils.parseUnits("1", 18), //TDB
        await getTxOpts()
      );
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Added compound strategy to vault");
  }

  console.log(
    "a_aave_strategy deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

aaveStrategy.dependencies = ["core"];

module.exports = aaveStrategy;
