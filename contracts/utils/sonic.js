const { formatUnits } = require("ethers/lib/utils");

const { getBlock } = require("../tasks/block");
const addresses = require("../utils/addresses");
const { resolveContract, resolveAsset } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:sonic");

async function setDefaultValidator({ id }) {
  const signer = await getSigner();

  const strategy = await resolveContract(
    `SonicStakingStrategyProxy`,
    "SonicStakingStrategy"
  );

  log(`About to setDefaultValidatorId to ${id}`);
  const tx = await strategy.connect(signer).setDefaultValidatorId(id);
  await logTxDetails(tx, "setDefaultValidatorId");
}

async function snapSonicStaking(taskArguments) {
  const { block } = taskArguments;

  const blockTag = await getBlock(block);
  const ws = await resolveAsset("wS");
  const sonicStakingStrategy = await resolveContract(
    "SonicStakingStrategyProxy",
    "SonicStakingStrategy"
  );
  const sfc = await resolveContract(addresses.sonic.SFC, "ISFC");

  // Get the strategy balance
  const strategyBalance = await sonicStakingStrategy.checkBalance(ws.address, {
    blockTag,
  });
  const pendingWithdrawals = await sonicStakingStrategy.pendingWithdrawals({
    blockTag,
  });
  const pendingWithdrawalsPercentage = pendingWithdrawals
    .mul(10000)
    .div(strategyBalance);

  let totalStaked = ethers.BigNumber.from(0);
  let totalPendingRewards = ethers.BigNumber.from(0);
  for (const validatorId of [15, 16, 17, 18]) {
    console.log(`${validatorId}:`);
    const stakedAmount = await sfc.getStake(
      sonicStakingStrategy.address,
      validatorId,
      {
        blockTag,
      }
    );
    totalStaked = totalStaked.add(stakedAmount);
    const pendingRewards = await sfc.pendingRewards(
      sonicStakingStrategy.address,
      validatorId,
      { blockTag }
    );
    totalPendingRewards = totalPendingRewards.add(pendingRewards);

    console.log(`   Staked amount          : ${formatUnits(stakedAmount, 18)}`);
    console.log(
      `   Pending rewards        : ${formatUnits(pendingRewards, 18)}`
    );
  }

  const stakedPercent = totalStaked.mul(10000).div(strategyBalance);
  const pendingRewardsPercentage = totalPendingRewards
    .mul(10000)
    .div(strategyBalance);
  console.log(
    `\nTotal Staked              : ${formatUnits(
      totalStaked,
      18
    )} ${formatUnits(stakedPercent, 2)}%`
  );
  console.log(
    `Total pending withdrawals : ${formatUnits(
      pendingWithdrawals,
      18
    )} ${formatUnits(pendingWithdrawalsPercentage, 2)}%`
  );
  console.log(
    `Total pending rewards     : ${formatUnits(
      totalPendingRewards,
      18
    )} ${formatUnits(pendingRewardsPercentage, 2)}%`
  );
  console.log(
    `Strategy balance          : ${formatUnits(strategyBalance, 18)}`
  );
}

module.exports = {
  setDefaultValidator,
  snapSonicStaking,
};
