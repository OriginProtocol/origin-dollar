const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
  isGanacheFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");
const { utils } = require("ethers");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");



// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

//
// 1. Deploy new Single Asset Staking contract
//
const singleAssetStaking = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 004_single_asset_staking deployment...");

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy the liquidity reward proxy.
  let d = await deploy("OGNStakingProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
    from: deployerAddr,
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed OGNStakingProxy", d);

  // Deploy the liquidityReward.
  const dSingleAssetStaking = await deploy("SingleAssetStaking", {
    from: deployerAddr,
  });
  await ethers.provider.waitForTransaction(
    dSingleAssetStaking.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed SingleAssetStaking", dSingleAssetStaking);

  // Initialize the proxy.
  const cOGNStakingProxy = await ethers.getContract(
    "OGNStakingProxy"
  );
  let t = await cOGNStakingProxy[
    "initialize(address,address,bytes)"
  ](dSingleAssetStaking.address, deployerAddr, []);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized LiquidityRewardProxy");

  // Initialize the LquidityReward
  // Note: we are only doing DAI with Aave.
  const cOGNStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    cOGNStakingProxy.address
  );

  // let's give a 5 percent reward rate
  const rate = utils.parseUnits("0.05", 18);
  const day = 24 * 60 * 60;
  // starting durations are 90 days, 180 days, 365 days
  const durations = [ 90 * day, 180 * day, 360 * day];
  const rates = [ utils.parseUnits("0.085", 18), utils.parseUnits("0.145", 18), utils.parseUnits("0.30", 18) ];


  console.log("OGN Asset address:", assetAddresses.OGN);
  t = await cOGNStaking
    .connect(sDeployer)
    .initialize(assetAddresses.OGN, durations, rates);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized OGNSTaking");

  //
  // Transfer governance of the Reward proxy to the governor
  //  - On Mainnet the governance transfer gets executed separately, via the multi-sig wallet.
  //  - On other networks, this migration script can claim governance by the governor.
  //
  let strategyGovAddr;
  if (isMainnet) {
    // On Mainnet the governor is the TimeLock
    strategyGovAddr = (await ethers.getContract("MinuteTimelock")).address;
  } else {
    strategyGovAddr = governorAddr;
  }

  t = await cOGNStaking
    .connect(sDeployer)
    .transferGovernance(strategyGovAddr);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log(`LiquidReward transferGovernance(${strategyGovAddr} called`);

  if (!isMainnetOrRinkebyOrFork) {
    t = await cOGNStaking
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance();
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Claimed governance for LiquidityReward");

    const ogn = await ethers.getContract("MockOGN");
    // amount to load in for rewards
    // put in a small amount so that we can hit limits for testing
    const loadAmount = utils.parseUnits("299", 18);
    await ogn.connect(sGovernor).mint(loadAmount);
    await ogn
      .connect(sGovernor)
      .transfer(cOGNStaking.address, loadAmount);
  }

  // For mainnet we'd want to transfer OGN to the contract to cover any rewards

  console.log(
    "004_single_asset_staking deploy done."
  );

  return true;
};

singleAssetStaking.id = "004_single_asset_staking";
singleAssetStaking.dependencies = ["core"];

module.exports = singleAssetStaking;
