
// Displays an account OUSD balance and credits.
async function balance(taskArguments) {
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const balance = await ousd.balanceOf(taskArguments.account);
  const credits = await ousd.creditsBalanceOf(taskArguments.account);
  console.log("OUSD balance=", ethers.utils.formatUnits(balance.toString(), 18));
  console.log("OUSD credits=", ethers.utils.formatUnits(credits[0].toString(), 18));
  console.log("OUSD creditsPerToken=", ethers.utils.formatUnits(credits[1].toString(), 18));
}

module.exports = {
  balance
}