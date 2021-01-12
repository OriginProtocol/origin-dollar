const { utils } = require("ethers");
const { formatUnits } = utils;


async function balance(taskArguments) {
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const balance = await ousd.balanceOf(taskArguments.account);
  const credits = await ousd.creditsBalanceOf(taskArguments.account);
  console.log("OUSD balance=", formatUnits(balance.toString(), 18));
  console.log("OUSD credits=", formatUnits(credits.toString(), 18));
}

module.exports = {
  balance
}