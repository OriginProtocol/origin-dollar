const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../test/helpers.js");
const { premiumGasPrice } = require("../utils/gas");

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

// Returns extra options to use when sending a tx to the network.
// See https://buidler.dev/plugins/buidler-deploy.html for available options.
async function getTxOpts() {
  if (process.env.PREMIUM_GAS) {
    const gasPrice = await premiumGasPrice(process.env.PREMIUM_GAS);
    return { gasPrice };
  }
  return {};
}

const upgradeVault = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 2_vault_v2 deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault.
  const dVault = await deploy("Vault", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVault.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed Vault", dVault);

  // Update the proxy to use the new vault.
  const cVaultProxy = await ethers.getContract("VaultProxy");
  transaction = await cVaultProxy.connect(sGovernor).upgradeTo(dVault.address);
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Upgraded proxy to use new vault.")

  // Initialize the vault.
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const mixOracle = await ethers.getContract("MixOracle");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  transaction = await cVault
    .connect(sGovernor)
    .initialize(mixOracle.address, cOUSDProxy.address, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Initialized Vault ");

  // For the initial testing period, set the vault's
  // rebase threshold to $3 (using 18 decimals).
  transaction = await cVault
    .connect(sGovernor)
    .setRebaseThreshold(utils.parseUnits("3", 18), await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Rebased threshold set to $3");

  console.log(
    "2_vault_v2 deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeVault.dependencies = ["core"];
upgradeVault.skip = () => !isMainnet || !isRinkeby;

module.exports = upgradeVault;
