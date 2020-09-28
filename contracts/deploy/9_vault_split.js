const { isMainnet, isRinkeby, isMainnetOrRinkebyOrFork, isGanache } = require("../test/helpers.js");
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

const upgradeVault = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 9_vault_split deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  // Deploy a new vault.
  const dVaultCore = await deploy("VaultCore", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVaultCore.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed VaultCore", dVaultCore);

  const dVaultAdmin = await deploy("VaultAdmin", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVaultAdmin.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed VaultAdmin", dVaultAdmin);

  const dRebaseHooks = await deploy("RebaseHooks", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dRebaseHooks.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed RebaseHooks");


  // This is timelock where the delay is only a minute
  const dMinuteTimelock = await deploy("MinuteTimelock", {
    from: deployerAddr,
    args: [60],
    ...(await getTxOpts()),
  });

  await ethers.provider.waitForTransaction(
    dMinuteTimelock.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed MinuteTimelock", dMinuteTimelock);

  // NOTE:This args for these should be the timelock and the multisig on live!
  const dGovernor = await deploy("Governor", {
    from: deployerAddr,
    args: [dMinuteTimelock.address, governorAddr],
    ...(await getTxOpts()),
  });

  await ethers.provider.waitForTransaction(
    dGovernor.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );

  log("Deployed Governor", dGovernor);

  const cMinuteTimelock = await ethers.getContract("MinuteTimelock");
  await cMinuteTimelock.connect(sDeployer).initialize(dGovernor.address);

  if (!isMainnetOrRinkebyOrFork && !isGanache) {
    // On mainnet these transactions must be executed by governor multisig

    // Update the proxy to use the new vault.
    const cVaultProxy = await ethers.getContract("VaultProxy");
    transaction = await cVaultProxy
      .connect(sGovernor)
      .upgradeTo(dVaultCore.address, await getTxOpts());

    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Upgraded proxy to use new Vault");

    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );

    transaction = await cVaultCore
      .connect(sGovernor)
      .setAdminImpl(dVaultAdmin.address, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Set proxy to use new VaultAdmin");

    const cRebaseHooks = await ethers.getContractAt(
      "RebaseHooks",
      dRebaseHooks.address
    );

    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    transaction = await cVaultAdmin
      .connect(sGovernor)
      .setRebaseHooksAddr(cRebaseHooks.address);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log("Set RebaseHooks address on Vault");
  } else {
    const cRebaseHooks = await ethers.getContractAt(
      "RebaseHooks",
      dRebaseHooks.address
    );

    console.log("transfering cRebase hooks to:", cMinuteTimelock.address);
    // The deployer should have admin at this point..
    await cRebaseHooks.connect(sDeployer).transferGovernance(cMinuteTimelock.address)
  }

  console.log(
    "9_vault_split deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeVault.dependencies = ["core"];

module.exports = upgradeVault;
