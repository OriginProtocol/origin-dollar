const { ethers } = require("ethers");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const sonicStakingStrategyAbi = require("../abi/sonic_staking_strategy.json");
const erc20Abi = require("../abi/erc20.json");
const vaultAbi = require("../abi/vault.json");
const addresses = require("../utils/addresses");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:sonic");

async function undelegateValidator({ id, amount, signer }) {
  const sonicStakingStrategy = new ethers.Contract(
    addresses.sonic.SonicStakingStrategy,
    sonicStakingStrategyAbi,
    signer
  );
  const ws = new ethers.Contract(addresses.sonic.wS, erc20Abi, signer);
  const vault = new ethers.Contract(
    addresses.sonic.OSonicVaultProxy,
    vaultAbi,
    signer
  );

  let amountBN;
  if (amount == undefined) {
    const wsBalance = await ws.balanceOf(addresses.sonic.OSonicVaultProxy);
    const queue = await vault.withdrawalQueueMetadata();
    const pendingWithdrawals = await sonicStakingStrategy.pendingWithdrawals();

    const available = wsBalance
      .add(queue.claimed)
      .sub(queue.queued)
      .add(pendingWithdrawals);

    log(`Available balance: ${formatUnits(available, 18)} wS`);

    // Threshold is negative 1000 wS
    const threshold = parseUnits("1000", 18).mul(-1);
    if (available.gt(threshold)) {
      log(
        `No need to undelgate as available balance ${formatUnits(
          available,
          18
        )} wS is above threshold.`
      );
      return;
    }
    // Convert back to a positive amount
    amountBN = available.mul(-1);
  } else {
    // Use amount passed in from Hardhat task
    amountBN = parseUnits(amount.toString(), 18);
  }

  const validatorId = id || (await sonicStakingStrategy.defaultValidatorId());

  log(
    `About to undelegate ${formatUnits(
      amountBN
    )} S from validator ${validatorId}`
  );
  const tx = await sonicStakingStrategy
    .connect(signer)
    .undelegate(validatorId, amountBN);
  await logTxDetails(tx, "undelegate");
}

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

    if (request.undelegatedAmount.eq(0)) {
      log(`Request ${withdrawId} has already been withdrawn`);
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
  undelegateValidator,
  withdrawFromSFC,
};
