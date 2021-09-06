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

const deployName = "013_trustee";

/**
 * Deploys the vault trustee feature:
 *  - upgrade VaultCore
 *  - set trusteeAdress and trusteeFeeBps
 * @returns {Promise<boolean>}
 */
const trustee = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cvaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  // Deploy a new VaultCore contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");

  // Proposal for the governor to do the upgrades.
  const propDescription = "Trustee deploy and config";
  const trusteeAddress = "0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC"; // Strategist multi-sig
  const trusteeFeeBps = 1000; // 1000 bps = 10%
  const propArgs = await proposeArgs([
    {
      contract: cVaultProxy,
      signature: "upgradeTo(address)",
      args: [dVaultCore.address],
    },
    {
      contract: cvaultAdmin,
      signature: "setTrusteeAddress(address)",
      args: [trusteeAddress],
    },
    {
      contract: cvaultAdmin,
      signature: "setTrusteeFeeBps(uint256)",
      args: [trusteeFeeBps],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;

    await withConfirmation(
      cVaultProxy
        .connect(sGovernor)
        .upgradeTo(dVaultCore.address, await getTxOpts(gasLimit))
    );
    log("Upgraded VaultCore to new implementation");

    await withConfirmation(
      cvaultAdmin
        .connect(sGovernor)
        .setTrusteeAddress(trusteeAddress, await getTxOpts(gasLimit))
    );
    log("Trustee address set");

    await withConfirmation(
      cvaultAdmin
        .connect(sGovernor)
        .setTrusteeFeeBps(trusteeFeeBps, await getTxOpts(gasLimit))
    );
    log("Trustee fee bps set");
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await trustee(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["012_upgrades"];
main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;

module.exports = main;
