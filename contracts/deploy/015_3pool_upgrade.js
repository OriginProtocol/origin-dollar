const { isMainnet, isRinkeby } = require("../test/helpers.js");
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

const upgradeThreePool = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 015_3pool_upgrade deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);

  const dCurveUSDCStrategy = await deploy("CurveUSDCStrategy", {
    from: deployerAddr,
    contract: "ThreePoolStrategy",
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCurveUSDCStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CurveUSDCStrategy", dCurveUSDCStrategy);

  const dCurveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  transaction = await dCurveUSDCStrategyProxy
    .connect(sGovernor)
    .upgradeTo(dCurveUSDCStrategy.address, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Upgraded proxy to use new CurveUSDCStrategy strategy");

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

  const dCurveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  transaction = await dCurveUSDTStrategyProxy
    .connect(sGovernor)
    .upgradeTo(dCurveUSDTStrategy.address, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Upgraded proxy to use new CurveUSDTStrategy strategy");

  console.log(
    "015_3pool_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeThreePool.dependencies = ["core"];
upgradeThreePool.skip = () => false;

module.exports = upgradeThreePool;
