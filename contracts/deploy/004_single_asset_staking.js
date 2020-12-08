//
// Script to deploy the Single Asset Staking contract.
//
const {
  getAssetAddresses,
  isMainnet,
  isTest,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { utils } = require("ethers");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

const singleAssetStaking = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 004_single_asset_staking deployment...");

  const { governorAddr, deployerAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  //
  // Deploy contracts.
  //
  await deployWithConfirmation(
    "OGNStakingProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const dSingleAssetStaking = await deployWithConfirmation(
    "SingleAssetStaking"
  );

  //
  // Initialize
  //

  // Initialize the proxy.
  const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
  await withConfirmation(
    cOGNStakingProxy["initialize(address,address,bytes)"](
      dSingleAssetStaking.address,
      deployerAddr,
      []
    )
  );
  log("Initialized OGNStakingProxy");

  // Initialize the SingleAssetStaking contract.
  const cOGNStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    cOGNStakingProxy.address
  );

  const minute = 60;
  const day = 24 * 60 * minute;
  let durations;
  if (isMainnet || isTest) {
    // starting durations are 90 days, 180 days, 365 days
    durations = [90 * day, 180 * day, 360 * day];
  }
  // Rinkeby or localhost or ganacheFork need a shorter stake for testing purposes
  else {
    // add a very quick vesting rate ideal for testing (10 minutes)
    durations = [90 * day, 4 * minute, 360 * day];
  }
  const rates = [
    utils.parseUnits("0.085", 18),
    utils.parseUnits("0.145", 18),
    utils.parseUnits("0.30", 18),
  ];

  // Test PK is in scripts/staking/signStakingPayout.js
  const preApprover = isMainnetOrRinkebyOrFork
    ? process.env.STAKING_KEY
    : "0x5195f035B980B265C9cA9A83BD8A498dd9160Dff";

  console.log("OGN Asset address:", assetAddresses.OGN);
  await withConfirmation(
    cOGNStaking
      .connect(sDeployer)
      .initialize(assetAddresses.OGN, durations, rates, preApprover)
  );
  log("Initialized OGNStaking");

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

  await withConfirmation(
    cOGNStaking.connect(sDeployer).transferGovernance(strategyGovAddr)
  );
  log(`OGNStaking transferGovernance(${strategyGovAddr} called`);

  if (!isMainnetOrRinkebyOrFork) {
    await withConfirmation(cOGNStaking.connect(sGovernor).claimGovernance());
    log("Claimed governance for OGNStaking");

    const ogn = await ethers.getContract("MockOGN");
    // Amount to load in for rewards
    // Put in a small amount so that we can hit limits for testing
    const loadAmount = utils.parseUnits("299", 18);
    await ogn.connect(sGovernor).mint(loadAmount);
    await ogn.connect(sGovernor).transfer(cOGNStaking.address, loadAmount);
  }

  // For mainnet we'd want to transfer OGN to the contract to cover any rewards

  console.log("004_single_asset_staking deploy done.");

  return true;
};

singleAssetStaking.id = "004_single_asset_staking";
singleAssetStaking.dependencies = ["core"];

module.exports = singleAssetStaking;
