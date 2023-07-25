const { parseUnits, formatUnits } = require("ethers/lib/utils");

const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");
const { getBlock } = require("./block");

const log = require("../utils/logger")("task:valueChecker");

async function resolveValueChecker(symbol) {
  const contractPrefix = symbol === "OUSD" ? "" : symbol;
  const vaultValueChecker = await hre.ethers.getContract(
    `${contractPrefix}VaultValueChecker`
  );

  log(
    `Resolved ${symbol} VaultValueChecker to address ${vaultValueChecker.address}`
  );

  const vaultProxy = await hre.ethers.getContract(
    `${contractPrefix}VaultProxy`
  );
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
  log(`Resolved ${symbol} Vault to address ${vault.address}`);

  const oToken = await hre.ethers.getContract(symbol);
  log(`Resolved ${symbol} to address ${oToken.address}`);

  return { oToken, vaultValueChecker, vault };
}

async function takeSnapshot(taskArguments) {
  const { symbol } = taskArguments;
  const signer = await getSigner();

  const { vaultValueChecker } = await resolveValueChecker(symbol);

  log(`About to take vault value snapshot`);
  const tx = await vaultValueChecker.connect(signer).takeSnapshot();
  await logTxDetails(tx, "takeSnapshot");
}

async function getDelta(taskArguments) {
  const { block, symbol } = taskArguments;

  const signer = await getSigner();
  const signerAddr = await signer.getAddress();

  const { oToken, vaultValueChecker, vault } = await resolveValueChecker(
    symbol
  );

  const blockTag = getBlock(block);

  const snapshot = await vaultValueChecker.snapshots(signerAddr, { blockTag });

  const vaultValueAfter = await vault.totalValue({ blockTag });
  const vaultValueDelta = vaultValueAfter.sub(snapshot.vaultValue);

  log(
    `Value change ${formatUnits(vaultValueAfter)} - ${formatUnits(
      snapshot.vaultValue
    )} = ${formatUnits(vaultValueDelta)}`
  );

  const totalSupplyAfter = await oToken.totalSupply({ blockTag });
  const totalSupplyDelta = totalSupplyAfter.sub(snapshot.totalSupply);
  log(
    `Supply change ${formatUnits(totalSupplyAfter)} - ${formatUnits(
      snapshot.totalSupply
    )} = ${formatUnits(totalSupplyDelta)} ${symbol}`
  );

  const profit = vaultValueDelta.sub(totalSupplyDelta);
  log(
    `Profit:  ${formatUnits(vaultValueDelta)} - ${formatUnits(
      totalSupplyDelta
    )} = ${formatUnits(profit)} `
  );
}

async function checkDelta(taskArguments) {
  const { profit, profitVariance, symbol, vaultChange, vaultChangeVariance } =
    taskArguments;
  const signer = await getSigner();

  const contract = await resolveValueChecker(symbol);

  const profitUnits = parseUnits(profit.toString());
  const profitVarianceUnits = parseUnits(profitVariance.toString());
  const vaultChangeUnits = parseUnits(vaultChange.toString());
  const vaultChangeVarianceUnits = parseUnits(vaultChangeVariance.toString());

  log(`About to take check value value delta`);
  const tx = await contract
    .connect(signer)
    .checkDelta(
      profitUnits,
      profitVarianceUnits,
      vaultChangeUnits,
      vaultChangeVarianceUnits
    );
  await logTxDetails(tx, "checkDelta");
}

module.exports = {
  takeSnapshot,
  checkDelta,
  getDelta,
};
