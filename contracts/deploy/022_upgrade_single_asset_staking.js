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

const deployName = "022_upgrade_single_asset_staking";

const TRANSFER_AGENT = "0x522731a061e896B5Db9dDff9234fB5461A533710";

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
  const cSingleAssetStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    cOGNStakingProxy.address
  );
  const propDescription = "OGNStaking upgrade";
  const propArgs = await proposeArgs([
    {
      contract: cOGNStakingProxy,
      signature: "upgradeTo(address)",
      args: [dSingleAssetStaking.address],
    },
    {
      contract: cSingleAssetStaking,
      signature: "setTransferAgent(address)",
      args: [TRANSFER_AGENT],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    log("Executing proposal via governor...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    // Local testing environment. Upgrade via the governor account directly.
    await cOGNStakingProxy
      .connect(sGovernor)
      .upgradeTo(dSingleAssetStaking.address, await getTxOpts());
    await cSingleAssetStaking
      .connect(sGovernor)
      .setTransferAgent(TRANSFER_AGENT, await getTxOpts());

    log(`Upgraded OGNStaking to ${dSingleAssetStaking.address}`);
  }

  log(`${deployName} deploy done.`);
  return true;
};

upgradeSingleAssetStaking.id = deployName;
upgradeSingleAssetStaking.dependencies = ["core"];

// No need to execute on dev and test network since the contract already gets
// deployed with the latest code by the 004_single_asset_staking script.
upgradeSingleAssetStaking.skip = () => isFork || !(isMainnet || isRinkeby);

module.exports = upgradeSingleAssetStaking;
