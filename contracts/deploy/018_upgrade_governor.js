// Deploys the latest governor contract and sets its ownership to the new multisig safe wallet.
// Submits a proposal to call transferGovernance on all governable contracts.
// Once the proposal is executed, the claimGovernance() method should be called
// on all the contract from the new multisig wallet to finish transferring the governance.
const {
  isMainnet,
  isFork,
  isRinkeby,
  isSmokeTest,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");
const addresses = require("../utils/addresses");

const deployName = "018_upgrade_governor";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cChainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cThreePoolStrategyProxy = await hre.ethers.getContract(
    "ThreePoolStrategyProxy"
  );
  const cAaveStrategyProxy = await hre.ethers.getContract("AaveStrategyProxy");
  const cBuyback = await ethers.getContract("Buyback");
  const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
  const cCompensationClaim = await ethers.getContract("CompensationClaims");

  // Deploy a new governor contract.
  // The governor's admin is the guardian account (e.g. the multi-sig).
  // Set a min delay of 60sec for executing proposals.
  const dGovernor = await deployWithConfirmation("Governor", [
    addresses.mainnet.Guardian,
    60,
  ]);

  // Proposal for the governor update the contract
  const propDescription = "Transfer governance to the new governor";
  const propArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cVaultProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cChainlinkOracle,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cThreePoolStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cAaveStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cBuyback,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cOGNStakingProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cCompensationClaim,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    }
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    // Note: we send thr proposal to the old governor by passing explicitly its address.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription, { governorAddr });
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;
    await withConfirmation(
      cOUSDProxy
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on OUSDPoxy");

    await withConfirmation(
      cVaultProxy
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on VaultProxy");

    await withConfirmation(
      cChainlinkOracle
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on OracleRouter");

    await withConfirmation(
      cCompoundStrategyProxy
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on CompoundStrategyProxy");

    await withConfirmation(
      cThreePoolStrategyProxy.connect(sGovernor).transferGovernance(
        dGovernor.address,
        await getTxOpts(gasLimit)
      )
    );
    log("Called transferGovernance on ThreePoolStrategyProxy");

    await withConfirmation(
      cAaveStrategyProxy
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on AaveStrategyProxy");

    await withConfirmation(
      cBuyback
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on BuyBack");

    await withConfirmation(
      cOGNStakingProxy
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on OGNStakingProxy");

    await withConfirmation(
      cCompensationClaim
        .connect(sGovernor)
        .transferGovernance(dGovernor.address, await getTxOpts(gasLimit))
    );
    log("Called transferGovernance on CompensationClaim");
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await runDeployment(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["017_3pool_strategy_update"];
main.skip = () => !(isMainnet || isRinkeby || isFork) || isSmokeTest;

module.exports = main;
