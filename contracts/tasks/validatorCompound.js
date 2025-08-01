const addresses = require("../utils/addresses");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { getBlock } = require("../tasks/block");
const { calcDepositRoot } = require("./beaconTesting");
const { getValidatorBalance, getBeaconBlock } = require("../utils/beacon");
const { getNetworkName } = require("../utils/hardhat-helpers");
const { getSigner } = require("../utils/signers");
const { resolveContract } = require("../utils/resolvers");
const { getClusterInfo } = require("../utils/ssv");
const { logTxDetails } = require("../utils/txLogger");
const { BigNumber } = require("ethers");

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
    }, timestamp ${event.args.timestamp}, ETH balance ${formatUnits(
      event.args.ethBalance
    )}`
  );
}

async function registerValidator({ pubkey, shares, operatorids, ssv }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${(operatorids, ssv)}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const ssvAmount = parseUnits(ssv.toString(), 18);
  const { chainId } = await ethers.provider.getNetwork();

  let ownerAddress = "";
  if (chainId == 1) {
    // Hard code to the old 3rd native staking strategy for now
    ownerAddress = addresses.mainnet.NativeStakingSSVStrategy3Proxy;
    console.log(
      "Using Mainnet NativeStakingSSVStrategy3Proxy to fetch cluster Info"
    );
  } else if (chainId == 560048) {
    ownerAddress = "0x840081c97256d553A8F234D469D797B9535a3B49";
    console.log(
      "Using Hoodie CompoundingStakingSSVStrategy to fetch cluster Info"
    );
  } else {
    throw new Error(
      "Don't know what ownerAddress to use for fetching of cluster info"
    );
  }

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId,
    operatorids,
    ownerAddress: ownerAddress,
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
  // Send 1 wei of value to cover the request withdrawal fee
  const tx = await strategy
    .connect(signer)
    .validatorWithdrawal(pubkey, amountGwei, { value: 1 });
  await logTxDetails(tx, "validatorWithdrawal");
}

async function snapStakingStrategy({ block }) {
  const blockTag = await getBlock(block);

  const networkName = await getNetworkName();

  const wethAddress = addresses[networkName].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const ssvAddress = addresses[networkName].SSV;
  const ssv = await ethers.getContractAt("IERC20", ssvAddress);

  const strategy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy",
    "CompoundingStakingSSVStrategy"
  );

  // TODO verified validators
  const verifiedValidators = await strategy.getVerifiedValidators({
    blockTag,
  });
  const { stateView } = await getBeaconBlock();
  console.log(`\n${verifiedValidators.length} verified validator balances:`);
  let totalValidatorBalance = BigNumber.from(0);
  for (const validator of verifiedValidators) {
    const balance = stateView.balances.get(validator.index);
    console.log(
      `  ${validator.index} ${validator.pubKeyHash}: ${formatUnits(
        balance,
        9
      )} ETH`
    );
    totalValidatorBalance = totalValidatorBalance.add(balance);
  }

  // Pending deposits
  const deposits = await strategy.getPendingDeposits({ blockTag });
  let totalDeposits = BigNumber.from(0);
  console.log(`\n${deposits.length} pending deposits:`);
  for (const deposit of deposits) {
    console.log(
      `  ${formatUnits(deposit.amountGwei, 9)} ETH ${deposit.blockNumber} ${
        deposit.pubKeyHash
      }: `
    );
    totalDeposits = totalDeposits.add(deposit.amountGwei);
  }

  const stratWethBalance = await weth.balanceOf(strategy.address, { blockTag });
  const stratEthBalance = await ethers.provider.getBalance(
    strategy.address,
    blockTag
  );
  const stratSsvBalance = await ssv.balanceOf(strategy.address, { blockTag });
  const stratBalance = await strategy.checkBalance(wethAddress, {
    blockTag,
  });
  const lastSnapTimestamp = await strategy.lastSnapTimestamp({
    blockTag,
  });

  console.log(`\nTotal deposits     : ${formatUnits(totalDeposits, 9)} ETH`);
  console.log(
    `Total validators   : ${formatUnits(totalValidatorBalance, 9)} ETH`
  );
  console.log(`WETH balance       : ${formatUnits(stratWethBalance, 18)}`);
  console.log(`ETH balance        : ${formatUnits(stratEthBalance, 18)}`);
  console.log(`Strategy balance   : ${formatUnits(stratBalance, 18)}`);
  console.log(`SSV balance        : ${formatUnits(stratSsvBalance, 18)}`);
  console.log(
    `Last snap timestamp: ${lastSnapTimestamp} ${new Date(
      lastSnapTimestamp * 1000
    ).toISOString()} `
  );
}

module.exports = {
  snapBalances,
  registerValidator,
  stakeValidator,
  withdrawValidator,
  snapStakingStrategy,
};
