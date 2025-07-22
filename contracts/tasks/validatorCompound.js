const addresses = require("../utils/addresses");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { calcDepositRoot } = require("./beacon");
const { getValidatorBalance } = require("../utils/beacon");
const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const { getClusterInfo } = require("../utils/ssv");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:validator:compounding");

async function snapBalances() {
  const signer = await getSigner();

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  log(`About to snap balances for strategy ${strategy.address}`);
  const tx = await strategy.connect(signer).snapBalances();
  await logTxDetails(tx, "snapBalances");
}

async function registerValidator({ pubkey, shares, operatorids, ssv }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${(operatorids, ssv)}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const ssvAmount = parseUnits(ssv.toString(), 18);
  const { chainId } = await ethers.provider.getNetwork();

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId,
    operatorids,
    // Hard code to the old 3rd native staking strategy for now
    ownerAddress: addresses.mainnet.NativeStakingSSVStrategy3Proxy,
  });

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  log(`About to register validator with pubkey ${pubkey}`);
  const tx = await strategy
    .connect(signer)
    .registerSsvValidator(pubkey, operatorIds, shares, ssvAmount, cluster);
  await logTxDetails(tx, "registerValidator");
}

async function stakeValidator({ pubkey, sig, amount }) {
  const signer = await getSigner();

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
  await logTxDetails(tx, "stakeETH");
}

async function withdrawValidator({ pubkey, amount }) {
  const signer = await getSigner();

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  /// Get the validator's balance
  const balance = await getValidatorBalance(pubkey);

  const amountGwei = amount ? parseUnits(amount.toString(), 9) : balance;
  log(
    `About to withdraw ${formatUnits(
      amountGwei,
      9
    )} ETH from balance ${formatUnits(
      balance,
      9
    )} ETH from validator with pubkey ${pubkey}`
  );
  const tx = await strategy
    .connect(signer)
    .validatorWithdrawal(pubkey, amountGwei);
  await logTxDetails(tx, "validatorWithdrawal");
}

module.exports = {
  snapBalances,
  registerValidator,
  stakeValidator,
  withdrawValidator,
};
