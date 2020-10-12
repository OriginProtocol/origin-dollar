const {
  isMainnet,
  isRinkeby,
  getAssetAddresses,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const threePoolStrategiesDeploy = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  log("Running 12_three_pool_strategies deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const assetAddresses = await getAssetAddresses(deployments);

  //
  // Curve USDC Strategy and Proxy
  //
  const dCurveUSDCStrategyProxy = await deploy("CurveUSDCStrategyProxy", {
    from: deployerAddr,
    contract: "ThreePoolStrategyProxy",
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDCStrategyProxy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CurveUSDCStrategyProxy", dCurveUSDCStrategyProxy);

  const dCurveUSDCStrategy = await deploy("CurveUSDCStrategy", {
    from: deployerAddr,
    contract: "ThreePoolStrategy",
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDCStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CurveUSDCStrategy", dCurveUSDCStrategy);

  const cCurveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  // Get contract instance through Proxy
  const cCurveUSDCStrategy = await ethers.getContract(
    "CurveUSDCStrategy",
    cCurveUSDCStrategyProxy.address
  );

  transaction = await cCurveUSDCStrategy
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("CurveUSDCStrategy transferGovernance called");

  //
  // Curve USDT Strategy and Proxy
  //

  const dCurveUSDTStrategyProxy = await deploy("CurveUSDTStrategyProxy", {
    from: deployerAddr,
    contract: "ThreePoolStrategyProxy",
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDTStrategyProxy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CurveUSDTStrategyProxy", dCurveUSDTStrategyProxy);

  const dCurveUSDTStrategy = await deploy("CurveUSDTStrategy", {
    from: deployerAddr,
    contract: "ThreePoolStrategy",
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDTStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CurveUSDTStrategy", dCurveUSDTStrategy);

  const cCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  // Get contract instance through Proxy
  const CurveUSDTStrategy = await ethers.getContract(
    "CurveUSDTStrategy",
    cCurveUSDTStrategyProxy.address
  );

  transaction = await CurveUSDTStrategy.connect(sDeployer).transferGovernance(
    governorAddr,
    await getTxOpts()
  );
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("CurveUSDTStrategy transferGovernance called");

  if (!isMainnet && !isRinkeby) {
    const cVaultProxy = await ethers.getContract("VaultProxy");

    // Initialize CurveUSDCStrategyProxy
    transaction = await cCurveUSDCStrategyProxy[
      "initialize(address,address,bytes)"
    ](dCurveUSDCStrategy.address, governorAddr, []);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Initialized CurveUSDCStrategyProxy");

    // Initialize CurveUSDCStrategyj
    transaction = await cCurveUSDCStrategy
      .connect(sDeployer)
      ["initialize(address,address,address,address,address,address,address)"](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        assetAddresses.CRV,
        assetAddresses.USDC,
        assetAddresses.ThreePoolToken,
        assetAddresses.ThreePoolGauge,
        assetAddresses.CRVMinter
      );
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Initialized CurveUSDCStrategy");

    transaction = await cCurveUSDCStrategy
      .connect(sGovernor)
      .claimGovernance(await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );

    log("Claimed governance for CurveUSDCStrategy");

    // Initialize CurveUSDTStrategyProxy
    transaction = await cCurveUSDTStrategyProxy[
      "initialize(address,address,bytes)"
    ](dCurveUSDTStrategy.address, governorAddr, []);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );

    // Initialize CurveUSDTStrategy
    transaction = await CurveUSDTStrategy.connect(sDeployer)[
      "initialize(address,address,address,address,address,address,address)"
    ](
      assetAddresses.ThreePool,
      cVaultProxy.address,
      assetAddresses.CRV,
      assetAddresses.USDT,
      assetAddresses.ThreePoolToken,
      assetAddresses.ThreePoolGauge,
      assetAddresses.CRVMinter
    );
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Initialized CurveUSDTStrategy");

    // Claim governance with governor
    transaction = await CurveUSDTStrategy.connect(sGovernor).claimGovernance(
      await getTxOpts()
    );
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Claimed governance for CurveUSDTStrategy");
  }

  log(
    "12_three_pool_strategies deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

threePoolStrategiesDeploy.dependencies = ["core"];

module.exports = threePoolStrategiesDeploy;
