const {
  getAssetAddresses,
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

const deployName = "014_3pool_strategy";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cVaultCore = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );

  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  // Deploy new VaultAdmin implementation.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  // Deploy new CompoundStrategy implementation.
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");

  // Deploy new AaveStrategy implementation.
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");

  // Deploy 3Pool proxy and strategy.
  await deployWithConfirmation("ThreePoolStrategyProxy");
  const cThreePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );

  const dThreePoolStrategy = await deployWithConfirmation("ThreePoolStrategy");
  const cThreePoolStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    cThreePoolStrategyProxy.address
  );

  // Initialize 3Pool proxy.
  await withConfirmation(
    cThreePoolStrategyProxy["initialize(address,address,bytes)"](
      dThreePoolStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized ThreePool proxy");

  // Initialize 3Pool implementation.
  await withConfirmation(
    cThreePoolStrategy
      .connect(sDeployer)
      [
        "initialize(address,address,address,address[],address[],address,address)"
      ](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        assetAddresses.CRV,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        assetAddresses.ThreePoolGauge,
        assetAddresses.CRVMinter
      )
  );
  log("Initialized ThreePoolStrategy");

  // Initiate transfer of 3Pool ownership to the governor.
  await withConfirmation(
    cThreePoolStrategy
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`ThreePoolStrategy transferGovernance(${governorAddr} called`);

  // Proposal for the governor to claim governance and the strategy to be
  // approved on the Vault
  const propDescription = "Add 3pool strategy";
  const propArgs = await proposeArgs([
    {
      contract: cThreePoolStrategy,
      signature: "claimGovernance()",
    },
    {
      contract: cVault,
      signature: "approveStrategy(address)",
      args: [cThreePoolStrategyProxy.address],
    },
    {
      contract: cVaultCore,
      signature: "setAdminImpl(address)",
      args: [dVaultAdmin.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dCompoundStrategy.address],
    },
    {
      contract: cAaveStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dAaveStrategy.address],
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
      cThreePoolStrategy
        .connect(sGovernor)
        .claimGovernance(await getTxOpts(gasLimit))
    );
    log("Claimed governance of ThreePoolStrategy");
    await withConfirmation(
      cVault
        .connect(sGovernor)
        .approveStrategy(
          cThreePoolStrategyProxy.address,
          await getTxOpts(gasLimit)
        )
    );
    log("Approved ThreePoolStrategy on Vault");
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
main.dependencies = ["013_trustee"];
main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;

module.exports = main;
