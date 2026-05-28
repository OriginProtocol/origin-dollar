const { formatUnits, parseEther } = require("ethers").utils;

const log = require("./logger")("utils:validator");

const validatorsThatCanBeStaked = async (nativeStakingStrategy, WETH) => {
  const address = nativeStakingStrategy.address;
  const wethBalance = await WETH.balanceOf(address);
  log(
    `Native Staking Strategy has ${formatUnits(wethBalance, 18)} WETH in total`
  );

  const stakeETHThreshold = await nativeStakingStrategy.stakeETHThreshold();
  const stakeETHTally = await nativeStakingStrategy.stakeETHTally();
  const remainingWETH = stakeETHThreshold.sub(stakeETHTally);
  log(
    `Native Staking Strategy has staked ${formatUnits(
      stakeETHTally
    )} of ${formatUnits(stakeETHThreshold)} ETH with ${formatUnits(
      remainingWETH
    )} WETH remaining`
  );

  // Take the minimum of the remainingETH and the WETH balance
  const availableETH = wethBalance.gt(remainingWETH)
    ? remainingWETH
    : wethBalance;
  log(
    `Native Staking Strategy has ${formatUnits(
      availableETH
    )} WETH available to stake`
  );

  const validatorCountBN = availableETH.div(parseEther("32"));
  const validatorCount = parseInt(validatorCountBN.toString());
  log(`Native Staking Strategy can stake to ${validatorCount} validators`);
  return validatorCount;
};

module.exports = {
  validatorsThatCanBeStaked,
};
