const { parseUnits, formatUnits } = require("ethers/lib/utils");

const { resolveAsset } = require("../utils/assets");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");
const { ethereumAddress } = require("../utils/regex");
const { getBlock } = require("./block");

const log = require("../utils/logger")("task:tokens");

async function tokenBalance(taskArguments) {
  const { account, block, symbol } = taskArguments;
  const signer = await getSigner();

  const asset = await resolveAsset(symbol);
  const accountAddr = account || (await signer.getAddress());

  const blockTag = await getBlock(block);

  const balance = await asset
    .connect(signer)
    .balanceOf(accountAddr, { blockTag });

  const decimals = await asset.decimals();
  console.log(`${accountAddr} has ${formatUnits(balance, decimals)} ${symbol}`);
}
async function tokenAllowance(taskArguments) {
  const { block, owner, spender, symbol } = taskArguments;
  const signer = await getSigner();

  const asset = await resolveAsset(symbol);
  const ownerAddr = owner || (await signer.getAddress());

  const blockTag = await getBlock(block);

  const balance = await asset
    .connect(signer)
    .allowance(ownerAddr, spender, { blockTag });

  const decimals = await asset.decimals();
  console.log(
    `${ownerAddr} has allowed ${spender} to spend ${formatUnits(
      balance,
      decimals
    )} ${symbol}`
  );
}

async function tokenApprove(taskArguments) {
  const { amount, symbol, spender } = taskArguments;
  const signer = await getSigner();

  if (!spender.match(ethereumAddress)) {
    throw new Error(`Invalid Ethereum address: ${spender}`);
  }

  const asset = await resolveAsset(symbol);
  const assetUnits = parseUnits(amount.toString(), await asset.decimals());

  log(`About to approve ${spender} to spend ${amount} ${symbol}`);
  const tx = await asset.connect(signer).approve(spender, assetUnits);
  await logTxDetails(tx, "approve");
}

async function tokenTransfer(taskArguments) {
  const { amount, symbol, to } = taskArguments;
  const signer = await getSigner();

  if (!to.match(ethereumAddress)) {
    throw new Error(`Invalid Ethereum address: ${to}`);
  }

  const asset = await resolveAsset(symbol);
  const assetUnits = parseUnits(amount.toString(), await asset.decimals());

  log(`About to transfer ${amount} ${symbol} to ${to}`);
  const tx = await asset.connect(signer).transfer(to, assetUnits);
  await logTxDetails(tx, "transfer");
}

async function tokenTransferFrom(taskArguments) {
  const { amount, symbol, from, to } = taskArguments;
  const signer = await getSigner();

  if (!from.match(ethereumAddress)) {
    throw new Error(`Invalid from Ethereum address: ${to}`);
  }
  if (to && !to.match(ethereumAddress)) {
    throw new Error(`Invalid to Ethereum address: ${to}`);
  }
  const toAddr = to || (await signer.getAddress());

  const asset = await resolveAsset(symbol);
  const assetUnits = parseUnits(amount.toString(), await asset.decimals());

  log(`About to transfer ${amount} ${symbol} from ${from} to ${toAddr}`);
  const tx = await asset.connect(signer).transferFrom(from, toAddr, assetUnits);
  await logTxDetails(tx, "transferFrom");
}

module.exports = {
  tokenAllowance,
  tokenBalance,
  tokenApprove,
  tokenTransfer,
  tokenTransferFrom,
};
