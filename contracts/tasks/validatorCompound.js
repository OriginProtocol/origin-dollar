const addresses = require("../utils/addresses");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { getBlock } = require("../tasks/block");
const { calcDepositRoot } = require("./beaconTesting");
const {
  calcSlot,
  getValidatorBalance,
  getBeaconBlock,
} = require("../utils/beacon");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const { getClusterInfo, splitOperatorIds } = require("../utils/ssv");
const { logTxDetails } = require("../utils/txLogger");
const { BigNumber } = require("ethers");
const {
  createValidatorRequest,
  getValidatorRequestStatus,
  getValidatorRequestDepositData,
} = require("../utils/p2pValidatorCompound");

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
    }, block ${receipt.blockNumber} timestamp ${
      event.args.timestamp
    }, ETH balance ${formatUnits(event.args.ethBalance)}`
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
async function stakeValidator({ pubkey, sig, amount, uuid }) {
  const signer = await getSigner();

  if (uuid) {
    const {
      pubkey: _pubkey,
      sig: _sig,
      amount: _amount,
    } = await getValidatorRequestDepositData({ uuid });
    pubkey = _pubkey;
    sig = _sig;
    amount = _amount;
  }

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  const depositDataRoot = await calcDepositRoot(
    strategy.address,
    "0x02",
    pubkey,
    sig,
    amount
  );

  const amountGwei = parseUnits(amount.toString(), 9);

  log(
    `About to stake ${amount} ETH to validator with pubkey ${pubkey} and deposit root ${depositDataRoot}`
  );
  const tx = await strategy
    .connect(signer)
    .stakeEth({ pubkey, signature: sig, depositDataRoot }, amountGwei);
  const receipt = await logTxDetails(tx, "stakeETH");

  const event = receipt.events.find((event) => event.event === "ETHStaked");
  if (!event) {
    throw new Error("ETHStaked event not found in transaction receipt");
  }
  console.log(`Deposit ID: ${event.args.depositId}`);
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

  // Pending deposits
  const deposits = await strategy.getPendingDeposits({ blockTag });
  let totalDeposits = BigNumber.from(0);
  console.log(`\n${deposits.length || "No"} pending strategy deposits:`);
  if (deposits.length > 0) {
    console.log(
      `  amount   slot    public key hash                                                    deposit root`
    );
  }
  for (const deposit of deposits) {
    console.log(
      `  ${formatUnits(deposit.amountGwei, 9)} ETH ${deposit.slot} ${
        deposit.pubKeyHash
      } ${deposit.root}`
    );
    totalDeposits = totalDeposits.add(deposit.amountGwei);
  }

  if (stateView.pendingDeposits.length === 0) {
    console.log("No pending beacon chain deposits");
  } else {
    const firstBeaconDeposit = stateView.pendingDeposits.get(0);
    console.log(
      `${stateView.pendingDeposits.length} beacon chain deposits. The first has slot ${firstBeaconDeposit.slot}`
    );
  }

  // Verified validators
  const verifiedValidators = await strategy.getVerifiedValidators({
    blockTag,
  });
  console.log(`\n${verifiedValidators.length || "No"} verified validators:`);
  if (verifiedValidators.length > 0) {
    console.log(
      `  amount           index   status   public key hash                                                    Withdrawable Exit epoch`
    );
  }
  let totalValidators = BigNumber.from(0);
  for (const validator of verifiedValidators) {
    const balance = stateView.balances.get(validator.index);
    const status = await strategy.validatorState(validator.pubKeyHash, {
      blockTag,
    });
    const beaconValidator = stateView.validators.get(validator.index);
    console.log(
      `  ${formatUnits(balance, 9).padEnd(12)} ETH ${
        validator.index
      } ${validatorStatus(status).padEnd(8)} ${validator.pubKeyHash} ${
        beaconValidator.withdrawableEpoch || "\t\t"
      }     ${beaconValidator.exitEpoch || ""}`
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
  const lastSnapTimestamp = await strategy.lastSnapTimestamp({
    blockTag,
  });
  const lastVerifiedEthBalance = await strategy.lastVerifiedEthBalance({
    blockTag,
  });
  const depositedWethAccountedFor = await strategy.depositedWethAccountedFor({
    blockTag,
  });

  console.log(`\nBalances at block ${blockTag}:`);
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
    `Last snap timestamp: ${lastSnapTimestamp} ${new Date(
      lastSnapTimestamp * 1000
    ).toISOString()} `
  );
  console.log(`SSV balance        : ${formatUnits(stratSsvBalance, 18)}`);
  console.log(
    `WETH Deposits      : ${formatUnits(depositedWethAccountedFor, 18)}`
  );
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
    return "EXITED";
  } else if (status === 5) {
    return "REMOVED";
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

module.exports = {
  snapBalances,
  registerValidatorCreateRequest,
  registerValidator,
  stakeValidator,
  withdrawValidator,
  snapStakingStrategy,
  setRegistrator,
  validatorStatus,
};
