const { formatUnits } = require("ethers/lib/utils");

const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");
const { ethereumAddress } = require("../utils/regex");

const log = require("../utils/logger")("task:autoWithdrawal");

async function resolveAutoWithdrawalModule(hre, moduleAddress) {
  if (moduleAddress) {
    if (!moduleAddress.match(ethereumAddress)) {
      throw new Error(`Invalid module address: ${moduleAddress}`);
    }

    return await hre.ethers.getContractAt(
      "AutoWithdrawalModule",
      moduleAddress
    );
  }

  return await hre.ethers.getContract("AutoWithdrawalModule");
}

async function fundWithdrawals({ gasLimit, module }, hre) {
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const autoWithdrawalModule = await resolveAutoWithdrawalModule(hre, module);

  const assetAddress = await autoWithdrawalModule.asset();
  const asset = await hre.ethers.getContractAt("IBasicToken", assetAddress);
  const assetDecimals = await asset.decimals();
  const assetSymbol = await asset.symbol();
  const strategy = await autoWithdrawalModule.strategy();
  const shortfallBefore = await autoWithdrawalModule.pendingShortfall();

  log(
    `Calling fundWithdrawals() on AutoWithdrawalModule ${autoWithdrawalModule.address} from ${signerAddress}`
  );
  console.log(`Module              : ${autoWithdrawalModule.address}`);
  console.log(`Strategy            : ${strategy}`);
  console.log(`Asset               : ${assetSymbol} (${assetAddress})`);
  console.log(
    `Pending shortfall   : ${formatUnits(
      shortfallBefore,
      assetDecimals
    )} ${assetSymbol}, ${shortfallBefore} wei`
  );

  const txOptions = {};
  if (gasLimit !== undefined) {
    if (gasLimit <= 0) {
      throw new Error("Gas limit must be greater than zero");
    }

    txOptions.gasLimit = gasLimit;
    console.log(`Gas limit           : ${gasLimit}`);
  }

  const tx = await autoWithdrawalModule
    .connect(signer)
    .fundWithdrawals(txOptions);
  const receipt = await logTxDetails(tx, "fundWithdrawals");
  const shortfallAfter = await autoWithdrawalModule.pendingShortfall();

  console.log(
    `Remaining shortfall : ${formatUnits(
      shortfallAfter,
      assetDecimals
    )} ${assetSymbol}, ${shortfallAfter} wei`
  );

  const relevantEvents = (receipt.events || []).filter((event) =>
    [
      "LiquidityWithdrawn",
      "InsufficientStrategyLiquidity",
      "WithdrawalFailed",
    ].includes(event.event)
  );

  for (const event of relevantEvents) {
    console.log(`${event.event}:`, event.args);
  }
}

module.exports = {
  fundWithdrawals,
};
