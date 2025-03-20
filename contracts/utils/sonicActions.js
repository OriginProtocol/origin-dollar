const { ethers } = require("ethers");

const sonicStakingStrategyAbi = require("../abi/sonic_staking_strategy.json");
const addresses = require("../utils/addresses");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:sonic");

async function withdrawFromSFC({ signer }) {
  const sonicStakingStrategy = new ethers.Contract(
    addresses.sonic.SonicStakingStrategy,
    sonicStakingStrategyAbi,
    signer
  );

  const fourteenDaysAgo = Math.floor(
    (Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000
  );

  const withdrawIds = [];
  // Get the latest withdrawal request
  let withdrawId = (await sonicStakingStrategy.nextWithdrawId()) - 1;

  while (withdrawId >= 0) {
    const request = await sonicStakingStrategy.withdrawals(withdrawId);

    if (request.undelegateAmount == 0) {
      break;
    } else if (request.timestamp < fourteenDaysAgo) {
      log(`Request ${withdrawId} can be withdrawn`);
      withdrawIds.push(withdrawId);
    } else {
      log(`Request ${withdrawId} is not older than 14 days`);
    }

    withdrawId--;
  }

  // want to start with the oldest withdrawal request
  const reversedWithdrawIds = withdrawIds.reverse();
  for (const withdrawId of reversedWithdrawIds) {
    log(`About to withdraw id ${withdrawId} from sonic validator`);
    const tx = await sonicStakingStrategy
      .connect(signer)
      .withdrawFromSFC(withdrawId);
    await logTxDetails(tx, "withdrawFromSFC");
  }
}

module.exports = {
  withdrawFromSFC,
};
