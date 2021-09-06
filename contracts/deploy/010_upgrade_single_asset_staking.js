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
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "010_upgrade_single_asset_staking";

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
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
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
