const { isMainnet, isRinkeby } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

let totalDeployGasUsed = 0;
const isTestMainnet = process.env.TEST_MAINNET

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

const upgradeGovernor = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 10_propose_governor deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  // Deploy a brand new MinuteTimeLock and a new Governor
  // This is timelock where the delay is only a minute
  const dMinuteTimelock = await deploy("MinuteTimelock", {
    from: deployerAddr,
    args: [60], // needs to be a second different for it to deploy a new Timelock
    skipIfAlreadyDeployed:false,
    ...(await getTxOpts()),
  });

  await ethers.provider.waitForTransaction(
    dMinuteTimelock.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed MinuteTimelock", dMinuteTimelock);
  console.log("New MinuteTimelock at:", dMinuteTimelock.address);

  // NOTE: On mainnet, governorAddr is the multisig.
  const dGovernor = await deploy("Governor", {
    from: deployerAddr,
    args: [dMinuteTimelock.address, governorAddr],
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dGovernor.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log(`Deployed Governor and set guardian to ${governorAddr}`, dGovernor);
  console.log("New Governor address at:", dGovernor.address);

  const cMinuteTimelock = await ethers.getContract("MinuteTimelock");
  transaction = await cMinuteTimelock
    .connect(sDeployer)
    .initialize(dGovernor.address);
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log(`Initialized the TimeLock's governor to ${dGovernor.address}`);

  if (isMainnet || isRinkeby || isTestMainnet) {
    const cRebaseHooks = await ethers.getContract( "RebaseHooks");
    let initGovernor = sDeployer

    if (isTestMainnet) {
      //making the assumption here that this is the forked mainet and the deployer is not set to the current one
      initGovernor = await ethers.provider.getSigner('0xaed9fdc9681d61edb5f8b8e421f5cee8d7f4b04f'); //please unlock the deployer in ganache
    }

    // The deployer should have admin at this point..
    transaction = await cRebaseHooks
      .connect(initGovernor)
      .transferGovernance(cMinuteTimelock.address, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log(
      `Called transferGovernance to ${cMinuteTimelock.address} on rebaseHook`
    );
  }

  console.log(
    "10_propose_governor deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeGovernor.dependencies = ["core"];
upgradeGovernor.skip = () => !(isMainnet || isRinkeby || isTestMainnet);

module.exports = upgradeGovernor;
