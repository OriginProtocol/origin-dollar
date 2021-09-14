//
// Script to upgrade the Single Asset Staking contract.
//
const {
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  executeProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "007_upgrade_single_asset_staking";

const upgradeSingleAssetStaking = async ({ getNamedAccounts }) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  //
  // Deploy the new implementation.
  //
  const dSingleAssetStaking = await deployWithConfirmation(
    "SingleAssetStaking"
  );

  //
  // Upgrade.
  //
  const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
  const propDescription = "OGNStaking upgrade";
  const propArgs = await proposeArgs([
    {
      contract: cOGNStakingProxy,
      signature: "upgradeTo(address)",
      args: [dSingleAssetStaking.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet upgrade has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute a governance proposal to upgrade."
    );
    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    // Local testing environment. Upgrade via the governor account directly.
    await cOGNStakingProxy
      .connect(sGovernor)
      .upgradeTo(dSingleAssetStaking.address, await getTxOpts());
    log(`Upgraded OGNStaking to ${dSingleAssetStaking.address}`);
  }

  console.log(`${deployName} deploy done.`);
  return true;
};

upgradeSingleAssetStaking.id = deployName;
upgradeSingleAssetStaking.dependencies = ["core"];

// No need to execute on dev and test network since the contract already gets
// deployed with the latest code by the 004_single_asset_staking script.
upgradeSingleAssetStaking.skip = () => !(isMainnet || isRinkeby) || isFork;

module.exports = upgradeSingleAssetStaking;
