const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { resolveContract, resolveAsset } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:strategy");

async function checkBalance({ proxy, symbol }) {
  const signer = await getSigner();

  const asset = await resolveAsset(symbol);
  const strategy = await resolveContract(
    proxy,
    "InitializableAbstractStrategy"
  );

  const balance = await strategy.connect(signer).checkBalance(asset.address);
  console.log(`Strategy balance: ${formatUnits(balance)}`);
}

async function getRewardTokenAddresses({ proxy }) {
  const signer = await getSigner();

  const strategy = await resolveContract(
    proxy,
    "InitializableAbstractStrategy"
  );

  const rewardTokens = await strategy.connect(signer).getRewardTokenAddresses();
  console.log(`Strategy reward tokens for ${proxy} are: ${rewardTokens}`);
}

async function setRewardTokenAddresses({ proxy, symbol }) {
  const signer = await getSigner();

  const asset = await resolveAsset(symbol);
  const strategy = await resolveContract(
    proxy,
    "InitializableAbstractStrategy"
  );

  log(
    `About to set the reward tokens for the strategy ${proxy} to [${symbol}] ${asset.address}`
  );
  const tx = await strategy
    .connect(signer)
    .setRewardTokenAddresses([asset.address]);
  await logTxDetails(tx, "setRewardTokenAddresses");
}

async function transferToken({ proxy, symbol, amount }) {
  const signer = await getSigner();

  const asset = await resolveAsset(symbol);
  const strategy = await resolveContract(
    proxy,
    "InitializableAbstractStrategy"
  );
  const governor = await strategy.connect(signer).governor();

  const amountBN = amount
    ? parseUnits(amount.toString(), 18)
    : await asset.balanceOf(strategy.address);

  log(
    `About to transfer ${formatUnits(
      amountBN
    )} ${symbol} tokens to governor ${governor}`
  );
  const tx = await strategy
    .connect(signer)
    .transferToken(asset.address, amountBN);
  await logTxDetails(tx, "transferToken");
}

module.exports = {
  getRewardTokenAddresses,
  setRewardTokenAddresses,
  checkBalance,
  transferToken,
};
