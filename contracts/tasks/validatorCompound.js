const addresses = require("../utils/addresses");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const { getBlock } = require("../tasks/block");
const {
  calcDepositRoot,
  calcWithdrawalCredential,
} = require("./beaconTesting");
const {
  calcSlot,
  getValidatorBalance,
  getBeaconBlock,
} = require("../utils/beacon");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { getSigner } = require("../utils/signers");
const { verifyDepositSignatureAndMessageRoot } = require("../utils/beacon");
const { resolveContract } = require("../utils/resolvers");
const { getClusterInfo, splitOperatorIds } = require("../utils/ssv");
const { logTxDetails } = require("../utils/txLogger");
const {
  createValidatorRequest,
  getValidatorRequestStatus,
  getValidatorRequestDepositData,
} = require("../utils/p2pValidatorCompound");
const { toHex } = require("../utils/units");

const log = require("../utils/logger")("task:validator:compounding");

async function snapBalances() {
  const signer = await getSigner();

  // TODO check the slot of the first pending deposit is not zero

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  log(`About to snap balances for strategy ${strategy.address}`);
  const tx = await strategy.connect(signer).snapBalances();
  await logTxDetails(tx, "snapBalances");

  const receipt = await tx.wait();
  const event = receipt.events.find(
    (event) => event.event === "BalancesSnapped"
  );
  if (!event) {
    throw new Error("BalancesSnapped event not found in transaction receipt");
  }
  console.log(
    `Balances snapped successfully. Beacon block root ${
      event.args.blockRoot
    }, block ${receipt.blockNumber}, ETH balance ${formatUnits(
      event.args.ethBalance
    )}`
  );
}

async function registerValidatorCreateRequest({ days }) {
  await createValidatorRequest({
    validatorSpawnOperationalPeriodInDays: days,
  });
}

/**
 * If the UUID is passed to this function then pubkey, shares, operatorIds are
 * ignored and fetched from the P2P
 */
async function registerValidator({ pubkey, shares, operatorids, ssv, uuid }) {
  const signer = await getSigner();

  if (uuid) {
    const {
      pubkey: _pubkey,
      shares: _shares,
      operatorids: _operatorids,
    } = await getValidatorRequestStatus({ uuid });
    pubkey = _pubkey;
    shares = _shares;
    // unsorted string of operators
    operatorids = _operatorids;
  }

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = splitOperatorIds(operatorids);

  const ssvAmount = parseUnits(ssv.toString(), 18);

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  // Cluster details
  const { chainId } = await ethers.provider.getNetwork();
  const { cluster } = await getClusterInfo({
    chainId,
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`About to register compounding validator with pubkey ${pubkey}`);
  const tx = await strategy
    .connect(signer)
    .registerSsvValidator(pubkey, operatorIds, shares, ssvAmount, cluster);
  await logTxDetails(tx, "registerValidator");
}

/**
 * If the UUID is passed to this function then pubkey, sig, amount are
 * ignored and fetched from the P2P
 */
async function stakeValidator({
  dryrun,
  pubkey,
  sig,
  amount,
  withdrawalCredentials,
  depositMessageRoot,
  forkVersion,
  uuid,
}) {
  const signer = await getSigner();

  if (uuid) {
    const {
      pubkey: _pubkey,
      sig: _sig,
      amount: _amount,
      depositMessageRoot: _depositMessageRoot,
      withdrawalCredentials: _withdrawalCredentials,
      forkVersion: _forkVersion,
    } = await getValidatorRequestDepositData({ uuid });
    pubkey = _pubkey;
    sig = _sig;
    amount = _amount;
    withdrawalCredentials = _withdrawalCredentials;
    depositMessageRoot = _depositMessageRoot;
    forkVersion = _forkVersion;
  }

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  if (!withdrawalCredentials) {
    withdrawalCredentials = calcWithdrawalCredential("0x02", strategy.address);
  }

  if (amount == 1) {
    if (!sig) {
      throw new Error(
        "The signature is required for the first deposit of 1 ETH"
      );
    }
    await verifyDepositSignatureAndMessageRoot({
      pubkey,
      withdrawalCredentials,
      amount,
      signature: sig,
      depositMessageRoot,
      forkVersion,
    });
  } else {
    // The signatures doesn't mater after the first deposit
    sig =
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
  }

  const depositDataRoot = await calcDepositRoot(
    strategy.address,
    "0x02",
    pubkey,
    sig,
    amount
  );

  const amountGwei = parseUnits(amount.toString(), 9);

  if (dryrun) {
    console.log(`About to stake ${amount} ETH to validator with`);
    console.log(`  pubkey         : ${pubkey}`);
    console.log(`  signature      : ${sig}`);
    console.log(`  depositDataRoot: ${depositDataRoot}`);
    return;
  }

  log(
    `About to stake ${amount} ETH to validator with pubkey ${pubkey}, deposit root ${depositDataRoot} and signature ${sig}`
  );
  const tx = await strategy
    .connect(signer)
    .stakeEth({ pubkey, signature: sig, depositDataRoot }, amountGwei);
  const receipt = await logTxDetails(tx, "stakeETH");

  const event = receipt.events.find((event) => event.event === "ETHStaked");
  if (!event) {
    throw new Error("ETHStaked event not found in transaction receipt");
  }
  console.log(`Pending deposit root: ${event.args.pendingDepositRoot}`);
}

async function autoValidatorDeposits({
  signer,
  slot, // undefined = latest slot
  maxBalance: maxBalanceGwei = parseUnits("2030", 9),
  minDeposit: minDepositGwei = parseUnits("1.1", 9),
  dryrun = false,
}) {
  const networkName = await getNetworkName();
  const wethAddress = addresses[networkName].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );
  const strategyView = await resolveContract("CompoundingStakingStrategyView");

  // WETH in the strategy
  const wethInStrategy = await weth.balanceOf(strategy.address);
  log(`WETH balance in strategy ${formatUnits(wethInStrategy, 18)}`);
  // Convert wei balance to gwei
  let remainingGwei = wethInStrategy.div(parseUnits("1", 9));

  if (remainingGwei.lt(minDepositGwei)) {
    log(
      `${formatUnits(
        remainingGwei,
        9
      )} WETH balance in strategy less than ${formatUnits(
        minDepositGwei,
        9
      )} ETH min deposit. Stopping`
    );
    return;
  }

  // 2. Get the staking strategy's active validators and pending deposits

  const verifiedValidators = await strategyView.getVerifiedValidators();
  const activeValidators = verifiedValidators.filter(
    (validator) => validator.state === 4 // ACTIVE
  );
  const pendingDeposits = await strategyView.getPendingDeposits();

  // 3. Calculate validators balances after all the pending deposits have been processed

  // Get beacon chain data
  const { stateView } = await getBeaconBlock(slot);

  let validators = [];
  // Iterate over the active validators
  for (const validator of activeValidators) {
    // get the validator's balance
    let balanceGwei = stateView.balances.get(validator.index);
    log(
      `  Validator ${validator.index} balance ${formatUnits(
        balanceGwei,
        9
      )} ETH`
    );

    // Add any pending deposits for this validator's balance
    for (const deposit of pendingDeposits) {
      if (deposit.pubKeyHash === validator.pubKeyHash) {
        balanceGwei = BigNumber.from(balanceGwei.toString()).add(
          deposit.amountGwei
        );
        log(
          `  Pending deposit of ${formatUnits(
            deposit.amountGwei,
            9
          )} ETH for validator ${validator.index}. New balance ${formatUnits(
            balanceGwei,
            9
          )} ETH`
        );
      }
    }

    // Get the validator public key
    const { pubkey } = stateView.validators.get(validator.index);
    validators.push({
      index: validator.index,
      pubKey: toHex(pubkey),
      balanceGwei: BigNumber.from(balanceGwei.toString()),
    });
  }

  // 4. Filter and sort validators

  // Filter out any validators that are already at or above the max balance
  const filteredValidators = validators.filter((v) =>
    v.balanceGwei.lt(maxBalanceGwei)
  );
  // Sort by largest to smallest balance
  const sortedValidators = filteredValidators.sort((a, b) =>
    a.balanceGwei.gt(b.balanceGwei) ? -1 : 1
  );

  // 5. Iterate over each validator and top up to max ETH if necessary

  const emptySignature =
    "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  // For each active validator that is under the max balance
  for (const validator of sortedValidators) {
    const maxDepositAmount = maxBalanceGwei.sub(validator.balanceGwei);
    const depositAmountGwei = remainingGwei.lt(maxDepositAmount)
      ? remainingGwei
      : maxDepositAmount;

    if (depositAmountGwei.lt(minDepositGwei)) continue;

    log(
      `About to top up validator ${validator.index} with ${formatUnits(
        depositAmountGwei,
        9
      )} WETH`
    );

    if (!dryrun) {
      // Calculate the deposit data root
      const depositDataRoot = await calcDepositRoot(
        strategy.address,
        "0x02",
        validator.pubKey,
        // This sig doesn't matter after the first deposit
        emptySignature,
        // Need to convert to an ETH amount with no decimals
        formatUnits(depositAmountGwei, 9)
      );

      // Call the strategy to deposit to the beacon deposit contract
      const tx = await strategy.connect(signer).stakeEth(
        {
          pubkey: validator.pubKey,
          signature: emptySignature,
          depositDataRoot,
        },
        depositAmountGwei
      );
      await logTxDetails(tx, "stakeEth");
    }

    // Reduce the remaining amount that needs to be deposited
    remainingGwei = remainingGwei.sub(depositAmountGwei);

    if (remainingGwei.lt(minDepositGwei)) {
      log(
        `${formatUnits(
          remainingGwei,
          9
        )} WETH remaining less than ${formatUnits(
          minDepositGwei,
          9
        )} WETH min deposit. Stopping`
      );
      break;
    }
  }

  if (remainingGwei.gt(0)) {
    log(
      `${formatUnits(
        remainingGwei,
        9
      )} WETH remaining. Need more active validators before it can be deposited`
    );
  }
}

async function withdrawValidator({ pubkey, amount, signer }) {
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  /// Get the validator's balance
  const balance = await getValidatorBalance(pubkey);

  const isFullExit = amount === undefined || amount === 0;
  const amountGwei = isFullExit ? 0 : parseUnits(amount.toString(), 9);
  if (isFullExit) {
    log(
      `About to fully exit validator with balance ${formatUnits(
        balance,
        9
      )} ETH and pubkey ${pubkey}`
    );
  } else {
    log(
      `About to partially withdraw ${formatUnits(
        amountGwei,
        9
      )} ETH from validator with balance ${formatUnits(
        balance,
        9
      )} ETH and pubkey ${pubkey}`
    );
  }
  // Send 1 wei of value to cover the request withdrawal fee
  const tx = await strategy
    .connect(signer)
    .validatorWithdrawal(pubkey, amountGwei, { value: 1 });
  await logTxDetails(tx, "validatorWithdrawal");
}

async function autoValidatorWithdrawals({
  signer,
  slot, // undefined = latest slot
  buffer: bufferBps = 100, // 1% buffer
  minValidatorWithdrawAmount = BigInt(10e18),
  minStrategyWithdrawAmount = parseUnits("0.1", 18),
  dryrun = false,
}) {
  const networkName = await getNetworkName();
  const wethAddress = addresses[networkName].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const vaultAddress = addresses[networkName].OETHVaultProxy;
  const vault = await ethers.getContractAt("IVault", vaultAddress);
  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );
  const strategyView = await resolveContract("CompoundingStakingStrategyView");

  // 1. Calculate the WETH available in the vault = WETH balance - withdrawals queued + withdrawals claimed

  const wethInVault = await weth.balanceOf(
    addresses[networkName].OETHVaultProxy
  );
  log(`WETH balance in vault ${formatUnits(wethInVault, 18)}`);

  const vaultWithdrawals = await vault.withdrawalQueueMetadata();

  const availableInVault = wethInVault
    .sub(vaultWithdrawals.queued)
    .add(vaultWithdrawals.claimed);
  log(`WETH available in vault ${formatUnits(availableInVault, 18)}`);

  // 2. Get the staking strategy's active validator indexes

  const activeValidators = await strategyView.getVerifiedValidators();
  const validatorIndexes = activeValidators.map((v) => v.index);

  // 3. Calculate pending validator partial withdrawal = sum amount in the partial withdrawal from the beacon chain data

  // Get beacon chain data
  const { stateView } = await getBeaconBlock(slot);

  const totalPendingPartialWithdrawals = await totalPartialWithdrawals(
    stateView,
    validatorIndexes
  );

  // 5. Calculate the buffer amount = total assets * buffer in basis points
  const totalAssets = await vault.totalValue();
  const buffer = totalAssets.mul(bufferBps).div(10000);
  log(`Buffer amount ${formatUnits(buffer, 18)} (${bufferBps} bps)`);

  // 4. Remaining amount = WETH available in the vault * -1 + buffer - pending withdrawals - any ETH or WETH in the staking strategy

  let remainingAmount = availableInVault
    .mul(-1)
    .add(buffer)
    .sub(totalPendingPartialWithdrawals);

  log(`Remaining amount to withdraw ${formatUnits(remainingAmount, 18)}`);

  // End job if remaining amount < 0
  if (remainingAmount.lt(0)) {
    log(`No need to withdraw from the validators.`);
    return;
  }

  // 5. Withdraw any WETH or ETH in the staking strategy

  const wethInStrategy = await weth.balanceOf(strategy.address);
  const ethInStrategy = await ethers.provider.getBalance(strategy.address);
  const availableInStrategy = wethInStrategy.add(ethInStrategy);
  log(
    `${formatUnits(wethInStrategy, 18)} WETH and ${formatUnits(
      ethInStrategy,
      18
    )} ETH in strategy = ${formatUnits(
      availableInStrategy,
      18
    )} available in strategy`
  );

  const withdrawAmount = remainingAmount.lt(availableInStrategy)
    ? remainingAmount
    : availableInStrategy;
  if (withdrawAmount.gt(minStrategyWithdrawAmount)) {
    log(
      `Withdrawing ${formatUnits(
        withdrawAmount,
        18
      )} ETH/WETH from the strategy`
    );

    if (!dryrun) {
      const tx = await strategy
        .connect(signer)
        .withdraw(vaultAddress, wethAddress, withdrawAmount);
      await logTxDetails(tx, "withdrawFromStrategy");
    }

    remainingAmount = remainingAmount.sub(withdrawAmount);
    if (remainingAmount.lte(0)) {
      log(`Reached the required withdrawal amount`);
      return;
    }
  }

  // 6. Withdraw from the validators is necessary

  // Get validator balances from the beacon chain data
  const validators = [];
  for (let i = 0; i < activeValidators.length; i++) {
    const validatorIndex = activeValidators[i].index;
    const validator = stateView.validators.get(validatorIndex);
    const balanceGwei = stateView.balances.get(validatorIndex);
    validators.push({
      index: validatorIndex,
      pubKey: toHex(validator.pubkey),
      balanceWei: parseUnits(balanceGwei.toString(), 9),
    });
    log(
      `  Validator ${validatorIndex} balance ${formatUnits(balanceGwei, 9)} ETH`
    );
  }

  // Sort validators by smallest to highest balance
  const sortedValidators = validators.sort((a, b) =>
    a.balanceWei.lt(b.balanceWei) ? -1 : 1
  );

  // For each validator
  for (const validator of sortedValidators) {
    const maxValidatorWithdrawal = validator.balanceWei.sub(
      parseUnits("32.25", 18)
    );
    const withdrawalAmount = maxValidatorWithdrawal.lt(remainingAmount)
      ? maxValidatorWithdrawal
      : remainingAmount;

    // continue if withdrawal amount < min partial withdraw amount
    if (withdrawalAmount < minValidatorWithdrawAmount) {
      log(
        `  Skipping validator ${
          validator.index
        } as withdrawal amount ${formatUnits(
          withdrawalAmount.toString(),
          18
        )} is less than the minimum partial withdrawal amount`
      );
      continue;
    }

    log(
      `  Withdrawing ${formatUnits(withdrawalAmount, 18)} ETH from validator ${
        validator.index
      }`
    );

    if (!dryrun) {
      // Call strategy to partially withdraw from the validator
      await strategy
        .connect(signer)
        .validatorWithdrawal(validator.pubKey, withdrawalAmount.toString(), {
          value: 1,
        });
    }

    remainingAmount = remainingAmount.sub(withdrawalAmount);
    if (remainingAmount.lte(0)) {
      log(`  Reached the required withdrawal amount`);
      break;
    }
  }

  if (remainingAmount.gt(0)) {
    log(
      `  Still need to withdraw ${formatUnits(
        remainingAmount,
        18
      )} ETH from the validators next time`
    );
  }
}

/**
 * Sums the pending partial withdrawals for a set of validator indexes
 * @param {*} stateView
 * @param {*} validatorIndexes array of validator indexes to check for pending partial withdrawals
 * @returns the total amount to 18 decimal places
 */
async function totalPartialWithdrawals(stateView, validatorIndexes) {
  // Iterate over the pending partial withdrawals
  let totalGwei = BigNumber.from(0);
  let count = 0;
  for (let i = 0; i < stateView.pendingPartialWithdrawals.length; i++) {
    const withdrawal = stateView.pendingPartialWithdrawals.get(i);

    if (validatorIndexes.includes(withdrawal.validatorIndex)) {
      log(
        `  Pending partial withdrawal of ${formatUnits(
          withdrawal.amount,
          9
        )} ETH from validator index ${withdrawal.validatorIndex}`
      );
      totalGwei = totalGwei.add(withdrawal.amount);
      count++;
    }
  }
  log(
    `${count} of ${
      stateView.pendingPartialWithdrawals.length
    } pending partial withdrawals from beacon chain totalling ${formatUnits(
      totalGwei,
      9
    )} ETH`
  );

  // Scale up to 18 decimals
  return parseUnits(totalGwei.toString(), 9);
}

async function snapStakingStrategy({ block }) {
  let blockTag = await getBlock(block);
  // Don't use the latest block as the slot probably won't be available yet
  if (!block) blockTag -= 1;

  const { timestamp } = await ethers.provider.getBlock(blockTag);
  const networkName = await getNetworkName();
  const slot = calcSlot(timestamp, networkName);
  log(`Snapping block ${blockTag} at slot ${slot}`);

  const { stateView } = await getBeaconBlock(slot);

  const wethAddress = addresses[networkName].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const ssvAddress = addresses[networkName].SSV;
  const ssv = await ethers.getContractAt("IERC20", ssvAddress);

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );
  const strategyView = await resolveContract("CompoundingStakingStrategyView");

  // Pending deposits
  const totalDeposits = await logDeposits(strategyView, blockTag, stateView);

  if (stateView.pendingDeposits.length === 0) {
    console.log("No pending beacon chain deposits");
  } else {
    const firstBeaconDeposit = stateView.pendingDeposits.get(0);
    console.log(
      `${
        stateView.pendingDeposits.length
      } beacon chain deposits. The first has slot ${
        firstBeaconDeposit.slot
      } and public key ${toHex(firstBeaconDeposit.pubkey)}`
    );
  }

  // Verified validators
  const verifiedValidators = await strategyView.getVerifiedValidators({
    blockTag,
  });
  console.log(`\n${verifiedValidators.length || "No"} verified validators:`);
  if (verifiedValidators.length > 0) {
    console.log(
      `  amount (ETH)   index   status   public key                                                                                         Withdrawable Exit epoch`
    );
  }
  let totalValidators = BigNumber.from(0);
  for (const validator of verifiedValidators) {
    const balance = stateView.balances.get(validator.index);
    const validatorData = await strategy.validator(validator.pubKeyHash, {
      blockTag,
    });
    const beaconValidator = stateView.validators.get(validator.index);
    console.log(
      `  ${formatUnits(balance, 9).padEnd(14)} ${
        validator.index
      } ${validatorStatus(validatorData.state).padEnd(8)} ${toHex(
        beaconValidator.pubkey
      )} ${beaconValidator.withdrawableEpoch || "\t\t"}     ${
        beaconValidator.exitEpoch || ""
      }`
    );
    totalValidators = totalValidators.add(balance);
  }
  console.log(
    `${
      stateView.pendingPartialWithdrawals.length || "No"
    } pending beacon chain withdrawals`
  );

  const stratWethBalance = await weth.balanceOf(strategy.address, { blockTag });
  const stratEthBalance = await ethers.provider.getBalance(
    strategy.address,
    blockTag
  );
  const stratSsvBalance = await ssv.balanceOf(strategy.address, { blockTag });
  const stratBalance = await strategy.checkBalance(wethAddress, {
    blockTag,
  });
  const totalAssets = parseUnits(totalDeposits.toString(), 9)
    .add(parseUnits(totalValidators.toString(), 9))
    .add(stratWethBalance)
    .add(stratEthBalance);
  const assetDiff = totalAssets.sub(stratBalance);
  const snappedBalance = await strategy.snappedBalance({
    blockTag,
  });
  const snappedSlot =
    snappedBalance.timestamp == 0
      ? 0n
      : calcSlot(snappedBalance.timestamp, networkName);
  const lastVerifiedEthBalance = await strategy.lastVerifiedEthBalance({
    blockTag,
  });
  const depositedWethAccountedFor = await strategy.depositedWethAccountedFor({
    blockTag,
  });

  console.log(`\nBalances at block ${blockTag}, slot ${slot}:`);
  console.log(`Deposits           : ${formatUnits(totalDeposits, 9)}`);
  console.log(`Validator balances : ${formatUnits(totalValidators, 9)}`);
  console.log(`WETH in strategy   : ${formatUnits(stratWethBalance, 18)}`);
  console.log(`ETH in strategy    : ${formatUnits(stratEthBalance, 18)}`);
  console.log(`Total assets       : ${formatUnits(totalAssets, 18)}`);
  console.log(
    `Strategy balance   : ${formatUnits(stratBalance, 18)} diff ${formatUnits(
      assetDiff,
      18
    )}`
  );
  console.log(
    `Last verified ETH  : ${formatUnits(lastVerifiedEthBalance, 18)}`
  );
  console.log(
    `Last snapped ETH   : ${formatUnits(snappedBalance.ethBalance, 18)}`
  );
  console.log(`Last snapped root  : ${snappedBalance.blockRoot}`);
  console.log(
    `Last snap timestamp: ${snappedBalance.timestamp} ${new Date(
      snappedBalance.timestamp * 1000
    ).toISOString()} `
  );
  console.log(
    `Last snap slot     : ${snappedSlot} (${slot - snappedSlot} slots ago)`
  );
  console.log(`SSV balance        : ${formatUnits(stratSsvBalance, 18)}`);
  console.log(
    `WETH Deposits      : ${formatUnits(depositedWethAccountedFor, 18)}`
  );
}

async function logDeposits(strategyView, blockTag = "latest", stateView) {
  const deposits = await strategyView.getPendingDeposits({ blockTag });
  let totalDeposits = BigNumber.from(0);
  console.log(`\n${deposits.length || "No"} pending strategy deposits:`);
  if (deposits.length > 0) {
    console.log(
      `  Pending deposit root                                               amount (ETH)   slot    Q pos public key`
    );
  }
  for (const deposit of deposits) {
    const { pendingDeposit, position } = findDepositInQueue(
      deposit.pendingDepositRoot,
      stateView
    );
    const pubKey = pendingDeposit
      ? toHex(pendingDeposit.pubkey)
      : deposit.pubKeyHash;
    console.log(
      `  ${deposit.pendingDepositRoot} ${formatUnits(
        deposit.amountGwei,
        9
      ).padEnd(14)} ${deposit.slot} ${position
        .toString()
        .padStart(5)} ${pubKey}`
    );
    totalDeposits = totalDeposits.add(deposit.amountGwei);
  }

  return totalDeposits;
}

function findDepositInQueue(pendingDepositRoot, stateView) {
  for (let i = 0; i < stateView.pendingDeposits.length; i++) {
    const pendingDeposit = stateView.pendingDeposits.get(i);
    if (toHex(pendingDeposit.hashTreeRoot()) === pendingDepositRoot) {
      return { pendingDeposit, position: i };
    }
  }
  return { pendingDeposit: undefined, position: -1 };
}

function validatorStatus(status) {
  if (status === 0) {
    return "NON_REGISTERED";
  } else if (status === 1) {
    return "REGISTERED";
  } else if (status === 2) {
    return "STAKED";
  } else if (status === 3) {
    return "VERIFIED";
  } else if (status === 4) {
    return "ACTIVE";
  } else if (status === 5) {
    return "EXITING";
  } else if (status === 6) {
    return "EXITED";
  } else if (status === 7) {
    return "REMOVED";
  } else if (status === 8) {
    return "INVALID";
  } else {
    return "UNKNOWN";
  }
}

async function setRegistrator({ account }) {
  const signer = await getSigner();

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const tx = await strategy.connect(signer).setRegistrator(account);
  await logTxDetails(tx, "setRegistrator");
}

async function removeValidator({ pubkey, operatorids }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = splitOperatorIds(operatorids);

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  // Cluster details
  const { chainId } = await ethers.provider.getNetwork();
  const { cluster } = await getClusterInfo({
    chainId,
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`About to remove compounding validator with pubkey ${pubkey}`);
  const tx = await strategy
    .connect(signer)
    .removeSsvValidator(pubkey, operatorIds, cluster);
  await logTxDetails(tx, "removeSsvValidator");
}

module.exports = {
  snapBalances,
  registerValidatorCreateRequest,
  registerValidator,
  stakeValidator,
  autoValidatorDeposits,
  snapStakingStrategy,
  logDeposits,
  setRegistrator,
  validatorStatus,
  withdrawValidator,
  autoValidatorWithdrawals,
  removeValidator,
};
