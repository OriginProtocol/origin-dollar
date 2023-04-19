import getDailyRewardsEmissions from './getDailyRewardsEmissions';

const getRewardsApy = (veOgvReceived, ogvToStake, totalSupplyVeOgv) => {
  if (totalSupplyVeOgv === 0 || ogvToStake === 0 || veOgvReceived === 0) {
    return 0;
  }

  const ogvPercentageOfRewards =
    veOgvReceived / (totalSupplyVeOgv + veOgvReceived);
  const dailyEmissions = getDailyRewardsEmissions();
  if (dailyEmissions === 0) {
    console.warn(
      'Reason for APY 0% -> no reward emissions for current timestamp.'
    );
  }
  const ogvRewardsDaily = dailyEmissions * ogvPercentageOfRewards;
  const ogvRewardsYearly = ogvRewardsDaily * 365.25; // accounting for leap year

  // No need to use actual prices since originating tokens and reward tokens have the same price
  const ogvLockupRewardApr = ogvRewardsYearly / ogvToStake;

  /* APR to APY formula:
   * APY = Math.pow((1 + Periodic Rate), Number of periods) – 1
   *
   * picking 1 (1 year) as a number of periods. Since the rewards are not really going to be
   * compounding in this case
   */
  return ((1 + ogvLockupRewardApr / 1) ** 1 - 1) * 100;
};

export default getRewardsApy;
