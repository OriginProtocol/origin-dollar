const { formatUnits, parseEther } = require("ethers").utils;
const {
  KeyValueStoreClient,
} = require("@openzeppelin/defender-kvstore-client");

const { getBlock } = require("./block");
const { checkPubkeyFormat } = require("./taskUtils");
const { getValidator, getValidators, getEpoch } = require("./beaconchain");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { logTxDetails } = require("../utils/txLogger");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { convertToBigNumber } = require("../utils/units");
const { validatorsThatCanBeStaked } = require("../utils/validator");
const { validatorKeys } = require("../utils/regex");

const log = require("../utils/logger")("task:p2p");

// This is in a separate file as it uses hardhat.
// We don't want the registerValidators and stakeValidators functions to use hardhat
// as they are using in Defender Actions.
// This is only used by Hardhat tasks registerValidators and stakeValidators
const validatorOperationsConfig = async (taskArgs) => {
  const networkName = await getNetworkName();

  const addressesSet = addresses[networkName];
  const isMainnet = networkName === "mainnet";

  const storeFilePath = require("path").join(
    __dirname,
    "..",
    `.localKeyValueStorage.${networkName}`
  );

  const WETH = await ethers.getContractAt("IWETH9", addressesSet.WETH);

  const nativeStakingStrategy = await resolveNativeStakingStrategyProxy(
    taskArgs.index
  );
  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

  const p2p_api_key = isMainnet
    ? process.env.P2P_MAINNET_API_KEY
    : process.env.P2P_HOLESKY_API_KEY;
  if (!p2p_api_key) {
    throw new Error(
      "P2P API key environment variable is not set. P2P_MAINNET_API_KEY or P2P_HOLESKY_API_KEY"
    );
  }
  const p2p_base_url = isMainnet ? "api.p2p.org" : "api-test-holesky.p2p.org";

  const awsS3AccessKeyId = process.env.AWS_ACCESS_S3_KEY_ID;
  const awsS3SexcretAccessKeyId = process.env.AWS_SECRET_S3_ACCESS_KEY;
  const s3BucketName = process.env.VALIDATOR_KEYS_S3_BUCKET_NAME;

  if (!awsS3AccessKeyId) {
    throw new Error("Secret AWS_ACCESS_S3_KEY_ID not set");
  }
  if (!awsS3SexcretAccessKeyId) {
    throw new Error("Secret AWS_SECRET_S3_ACCESS_KEY not set");
  }
  if (!s3BucketName) {
    throw new Error("Secret VALIDATOR_KEYS_S3_BUCKET_NAME not set");
  }

  // Convert the SSV amount to wei in string format if it is provided
  const ssvAmount =
    taskArgs.ssv >= 0
      ? parseEther(taskArgs.ssv.toString()).toString()
      : undefined;

  return {
    store: new KeyValueStoreClient({ path: storeFilePath }),
    p2p_api_key,
    p2p_base_url,
    nativeStakingStrategy,
    feeAccumulatorAddress,
    WETH,
    // how much SSV (expressed in days of runway) gets deposited into the
    // SSV Network contract on validator registration. This is calculated
    // at a Cluster level rather than a single validator.
    validatorSpawnOperationalPeriodInDays: taskArgs.days,
    clear: taskArgs.clear,
    uuid: taskArgs.uuid,
    maxValidatorsToRegister: taskArgs.validators,
    ssvAmount,
    awsS3AccessKeyId,
    awsS3SexcretAccessKeyId,
    s3BucketName,
  };
};

// @dev check validator is eligible for exit -
// has been active for at least 256 epochs
async function verifyMinActivationTime({ pubkey }) {
  const latestEpoch = await getEpoch("latest");
  const validator = await getValidator(pubkey);

  const epochDiff = latestEpoch.epoch - validator.activationepoch;

  if (epochDiff < 256) {
    throw new Error(
      `Can not exit validator. Validator needs to be ` +
        `active for 256 epoch. Current one active for ${epochDiff}`
    );
  }
}

async function getValidatorBalances({ pubkeys }) {
  const validator = await getValidators(pubkeys);

  // for
  log(
    `Validator balance of ${formatUnits(
      validator.balance
    )} for pub keys ${pubkeys}`
  );
  return validator.balance;
}

async function snapValidators({ pubkeys }) {
  if (!pubkeys.match(validatorKeys)) {
    throw Error(
      `Public keys not a comma-separated list of public keys with 0x prefixes`
    );
  }
  const validators = await getValidators(pubkeys);

  console.log(`Validators details`);
  console.log(`pubkey, balance, status, withdrawalcredentials`);
  for (const validator of validators) {
    console.log(
      `${validator.pubkey}, ${formatUnits(validator.balance, 9)}, ${
        validator.status
      }, ${validator.withdrawalcredentials}`
    );
  }
}

async function exitValidator({ index, pubkey, operatorids, signer }) {
  await verifyMinActivationTime({ pubkey });

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const strategy = await resolveNativeStakingStrategyProxy(index);

  log(`About to exit validator`);
  pubkey = checkPubkeyFormat(pubkey);

  const tx = await strategy
    .connect(signer)
    .exitSsvValidator(pubkey, operatorIds);
  await logTxDetails(tx, "exitSsvValidator");
}

async function doAccounting({ signer, nativeStakingStrategy }) {
  log(`About to doAccounting`);
  const tx = await nativeStakingStrategy.connect(signer).doAccounting();
  await logTxDetails(tx, "doAccounting");
}

async function manuallyFixAccounting({
  signer,
  nativeStakingStrategy,
  validatorsDelta,
  consensusRewardsDelta,
  ethToVaultAmount,
}) {
  const consensusRewardsDeltaBN = convertToBigNumber(consensusRewardsDelta);
  const ethToVaultAmountBN = convertToBigNumber(ethToVaultAmount);

  log(
    `About to manuallyFixAccounting with details ${validatorsDelta} validators, ${formatUnits(
      consensusRewardsDeltaBN
    )} consensus rewards, ${formatUnits(ethToVaultAmountBN)} ETH to vault`
  );

  const tx = await nativeStakingStrategy
    .connect(signer)
    .manuallyFixAccounting(
      validatorsDelta,
      consensusRewardsDeltaBN,
      ethToVaultAmountBN
    );
  await logTxDetails(tx, "manuallyFixAccounting");
}

async function resetStakeETHTally({ index, signer }) {
  const strategy = await resolveNativeStakingStrategyProxy(index);

  log(`About to resetStakeETHTally`);
  const tx = await strategy.connect(signer).resetStakeETHTally();
  await logTxDetails(tx, "resetStakeETHTally");
}

async function setStakeETHThreshold({ amount, index, signer }) {
  const strategy = await resolveNativeStakingStrategyProxy(index);

  const threshold = parseEther(amount.toString());

  log(`About to setStakeETHThreshold`);
  const tx = await strategy.connect(signer).setStakeETHThreshold(threshold);
  await logTxDetails(tx, "setStakeETHThreshold");
}

async function fixAccounting({ index, validators, rewards, ether, signer }) {
  const strategy = await resolveNativeStakingStrategyProxy(index);

  log(`About to fix accounting`);
  const tx = await strategy
    .connect(signer)
    .manuallyFixAccounting(validators, rewards, ether);
  await logTxDetails(tx, "manuallyFixAccounting");
}

async function pauseStaking({ index, signer }) {
  const strategy = await resolveNativeStakingStrategyProxy(index);

  log(`About to pause the Native Staking Strategy`);
  const tx = await strategy.connect(signer).pause();
  await logTxDetails(tx, "pause");
}

async function snapStaking({ block, admin, index }) {
  const blockTag = getBlock(block);

  const strategy = await resolveNativeStakingStrategyProxy(index);
  const feeAccumulator = await resolveFeeAccumulatorProxy(index);
  const vault = await resolveContract("OETHVaultProxy", "IVault");

  const networkName = await getNetworkName();

  const wethAddress = addresses[networkName].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const ssvAddress = addresses[networkName].SSV;
  const ssv = await ethers.getContractAt("IERC20", ssvAddress);

  const checkBalance = await strategy.checkBalance(wethAddress, { blockTag });
  const wethStrategyBalance = await weth.balanceOf(strategy.address, {
    blockTag,
  });
  const wethVaultBalance = await weth.balanceOf(vault.address, {
    blockTag,
  });
  const ssvStrategyBalance = await ssv.balanceOf(strategy.address, {
    blockTag,
  });
  const consensusRewards = await strategy.consensusRewards({ blockTag });
  const ethStrategyBalance = await ethers.provider.getBalance(
    strategy.address,
    blockTag
  );
  const ethFeeAccumulatorBalance = await ethers.provider.getBalance(
    feeAccumulator.address,
    blockTag
  );
  const validatorsForEth = await validatorsThatCanBeStaked(strategy, weth);
  const idleWethValidatorsBN = wethStrategyBalance
    .mul(10)
    .div(parseEther("32"));
  const idleWethRequestsBN = idleWethValidatorsBN.div(16);
  const paused = await strategy.paused({ blockTag });

  console.log(
    `Active validators        : ${await strategy.activeDepositedValidators({
      blockTag,
    })}`
  );
  console.log(
    `Strategy balance         : ${formatUnits(
      checkBalance
    )} ether, ${checkBalance} wei`
  );
  console.log(
    `Strategy ETH             : ${formatUnits(
      ethStrategyBalance
    )} ether, ${ethStrategyBalance} wei`
  );
  console.log(
    `Fee accumulator ETH      : ${formatUnits(
      ethFeeAccumulatorBalance
    )} ether, ${ethFeeAccumulatorBalance} wei`
  );
  console.log(
    `Consensus rewards        : ${formatUnits(
      consensusRewards
    )} ether, ${consensusRewards} wei`
  );
  console.log(
    `Deposited WETH           : ${formatUnits(
      await strategy.depositedWethAccountedFor({
        blockTag,
      })
    )}`
  );
  console.log(`Strategy WETH            : ${formatUnits(wethStrategyBalance)}`);
  console.log(`Vault    WETH            : ${formatUnits(wethVaultBalance)}`);
  console.log(`Strategy SSV             : ${formatUnits(ssvStrategyBalance)}`);

  const stakeETHThreshold = await strategy.stakeETHThreshold({ blockTag });
  const stakeETHTally = await strategy.stakeETHTally({ blockTag });

  console.log(`Stake ETH Tally          : ${formatUnits(stakeETHTally)}`);
  console.log(`Stake ETH Threshold      : ${formatUnits(stakeETHThreshold)}`);
  console.log(`Validators can be staked : ${validatorsForEth}`);
  console.log(
    `Validators from WETH     : ${formatUnits(
      idleWethValidatorsBN,
      1
    )} (${formatUnits(idleWethRequestsBN, 1)} requests)`
  );
  console.log(`Strategy paused          : ${paused}`);

  if (admin) {
    console.log(
      `Staking monitor          : ${await strategy.stakingMonitor()}`
    );
    console.log(
      `Validator registrator    : ${await strategy.validatorRegistrator()}`
    );
    console.log(`Governor                 : ${await strategy.governor()}`);
    console.log(`Strategist               : ${await vault.strategistAddr()}`);
    console.log(`Native staking strategy  : ${strategy.address}`);
    console.log(`Fee accumulator          : ${feeAccumulator.address}`);
  }
}

const resolveNativeStakingStrategyProxy = async (index) => {
  const proxyNumber =
    index === undefined || index === 1 ? "" : index.toString();

  const strategy = await resolveContract(
    `NativeStakingSSVStrategy${proxyNumber}Proxy`,
    "NativeStakingSSVStrategy"
  );

  return strategy;
};

const resolveFeeAccumulatorProxy = async (index) => {
  const proxyNumber = index === undefined ? "" : index.toString();

  const feeAccumulator = await resolveContract(
    `NativeStakingFeeAccumulator${proxyNumber}Proxy`,
    "FeeAccumulator"
  );

  return feeAccumulator;
};

module.exports = {
  validatorOperationsConfig,
  exitValidator,
  doAccounting,
  resetStakeETHTally,
  setStakeETHThreshold,
  fixAccounting,
  manuallyFixAccounting,
  pauseStaking,
  snapStaking,
  resolveNativeStakingStrategyProxy,
  resolveFeeAccumulatorProxy,
  getValidatorBalances,
  snapValidators,
};
