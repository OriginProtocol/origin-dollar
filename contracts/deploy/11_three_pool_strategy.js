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
    if (deployResult) {
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
  const { governorAddr } = await getNamedAccounts();

  log("Running 11_three_pool_strategies deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const assetAddresses = await getAssetAddresses(deployments);

  const dCRVUSDCStrategy = await deploy("CRVUSDCStrategy", {
    from: governorAddr,
    contract: "ThreePoolStrategy",
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCRVUSDCStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CRVUSDCStrategy", dCRVUSDCStrategy);

  const dCRVUSDTStrategy = await deploy("CRVUSDTStrategy", {
    from: governorAddr,
    contract: "ThreePoolStrategy",
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCRVUSDTStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CRVUSDTStrategy", dCRVUSDTStrategy);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  if (!isMainnet && !isRinkeby) {
    const CRVUSDCStrategy = await ethers.getContract("CRVUSDCStrategy");
    transaction = await CRVUSDCStrategy.connect(sGovernor).initialize(
      assetAddresses.ThreePool,
      cVaultProxy.address,
      assetAddresses.CRV[assetAddresses.USDC],
      [assetAddresses.ThreePoolToken],
      assetAddresses.ThreePoolGauge,
      assetAddresses.CRVMinter
    );
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Initializabled CRVUSDCStrategy");

    const CRVUSDTStrategy = await ethers.getContract("CRVUSDTStrategy");
    transaction = await CRVUSDTStrategy.connect(sGovernor).initialize(
      assetAddresses.ThreePool,
      cVaultProxy.address,
      assetAddresses.CRV[assetAddresses.USDT],
      [assetAddresses.ThreePoolToken],
      assetAddresses.ThreePoolGauge,
      assetAddresses.CRVMinter
    );
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Initializabled CRVUSDTStrategy");
  }

  log(
    "11_three_pool_strategies deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

threePoolStrategiesDeploy.dependencies = ["core"];

module.exports = threePoolStrategiesDeploy;
