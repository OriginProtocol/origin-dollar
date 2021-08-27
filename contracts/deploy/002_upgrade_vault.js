const hre = require("hardhat");
const { utils } = require("ethers");
const {
  isMainnet,
  isRinkeby,
  isFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const { proposeArgs } = require("../utils/governor");
const {
  deployWithConfirmation,
  withConfirmation,
  sleep,
} = require("../utils/deploy");

const addresses = require("../utils/addresses");

const upgradeVaultCoreAndAdmin = async ({ getNamedAccounts }) => {
  console.log("Running 002_vault_upgrade deployment...");

  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  // Deploy a new vault core contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  console.log("Deployed VaultCore");
  // Deploy a new vault admin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  console.log("Deployed VaultAdmin");

  if (isMainnet) {
    // The upgrade on Mainnet has to be handled manually since it involves a multi-sig tx.
    console.log(
      "Next step: submit a governance proposal on Mainnet to perform the upgrade."
    );
  } else if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    const binanceSigner = await ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governorAddr],
    });
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    await cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address);
    console.log("Upgraded VaultCore implementation to", dVaultCore.address);
    await cVaultCoreProxy.connect(sGovernor).setAdminImpl(dVaultAdmin.address);
    console.log("Upgraded VaultAdmin implementation to", dVaultAdmin.address);
  } else {
    // Upgrade the Vault by issuing and executing a governance proposal.
    const governorContract = await ethers.getContract("Governor");
    const sGuardian = sGovernor;

    console.log("Submitting proposal for Vault Core and Admin upgrade...");

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContract("VaultCore");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");

    const upgradeArgs = await proposeArgs([
      {
        contract: cVaultProxy,
        signature: "upgradeTo(address)",
        args: [cVaultCore.address],
      },
      {
        contract: cVaultCoreProxy,
        signature: "setAdminImpl(address)",
        args: [cVaultAdmin.address],
      },
    ]);

    const description = "Vault Core and Admin upgrade";
    await withConfirmation(
      governorContract.connect(sDeployer).propose(...upgradeArgs, description)
    );
    const proposalId = await governorContract.proposalCount();
    console.log(`Submitted proposal ${proposalId}`);

    console.log("Queueing proposal...");
    await governorContract.connect(sGuardian).queue(proposalId);
    console.log("Waiting for TimeLock. Sleeping for 61 seconds...");
    await sleep(61000);

    withConfirmation(governorContract.connect(sDeployer).execute(proposalId));
    console.log("Proposal executed");
    console.log(
      "Proposal executed. VaultCore now points to",
      cVaultCore.address
    );
    console.log(
      "Proposal executed. VaultAdmin now points to",
      cVaultAdmin.address
    );
  }

  console.log("002_vault_upgrade complete");

  return true;
};

upgradeVaultCoreAndAdmin.id = "002_upgrade_vault";
upgradeVaultCoreAndAdmin.dependencies = ["core"];
upgradeVaultCoreAndAdmin.skip = () => !(isMainnet || isRinkeby) || isFork;

module.exports = upgradeVaultCoreAndAdmin;
