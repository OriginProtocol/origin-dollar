import { SECONDS_IN_A_MONTH } from "../constants";
import { stakingDecayFactor, beginEpoch } from "../../constants";

const veOgvToOgv = (
  blockTimestamp: number,
  veOgvAmount: number,
  lockupDuration: number
): number => {
  // as specified here: https://github.com/OriginProtocol/ousd-governance/blob/master/contracts/OgvStaking.sol#L21

  // block.timestamp of when OgvStaking.sol was launched
  const duration = lockupDuration * SECONDS_IN_A_MONTH;
  // Since we'll be using blockTimestamp from CURRENT block, calculation will be
  // a hair outdated... but it's negligible
  const start = blockTimestamp > beginEpoch ? blockTimestamp : beginEpoch; // In prod, should always be blockTimestamp
  const end = start + duration;
  const dist = end - beginEpoch; // Distance between end of staking period and the very beginning when staking was launched
  const multiplier = dist / 365 / 86400;
  const lockupAmount = veOgvAmount / stakingDecayFactor ** multiplier;
  return lockupAmount;
};

export default veOgvToOgv;
