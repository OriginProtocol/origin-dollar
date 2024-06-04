const { parseUnits } = require("ethers").utils;

const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:weth");

const depositWETH = async ({ weth, amount, signer }) => {
  const etherAmount = parseUnits(amount.toString());

  log(`About to deposit ${amount} ETH for WETH`);
  const tx = await weth.connect(signer).deposit({ value: etherAmount });
  await logTxDetails(tx, "deposit");
};

const withdrawWETH = async ({ weth, amount, signer }) => {
  const etherAmount = parseUnits(amount.toString());

  log(`About to withdraw ${amount} ETH from WETH`);
  const tx = await weth.connect(signer).withdraw(etherAmount);
  await logTxDetails(tx, "withdraw");
};

module.exports = { depositWETH, withdrawWETH };
