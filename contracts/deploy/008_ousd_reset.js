const hre = require("hardhat");
const { utils } = require("ethers");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
  isMainnetOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "008_ousd_reset";

/**
 * Deploy AAVE Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dAaveStrategyProxy = await deployWithConfirmation(
    "AaveStrategyProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    dAaveStrategyProxy.address
  );
  await withConfirmation(
    cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      deployerAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized AaveStrategyProxy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      addresses.zero, // No reward token for Aave
      [assetAddresses.DAI],
      [assetAddresses.aDAI],
      await getTxOpts()
    )
  );
  log("Initialized AaveStrategy");

  //
  // Governance
  //
  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`AaveStrategy transferGovernance(${governorAddr} called`);

  const propDescription = "Aave strategy governor change";
  const propArgs = await proposeArgs([
    {
      contract: cAaveStrategy,
      signature: "claimGovernance()",
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute a governance proposal to claim governance."
    );
    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    await withConfirmation(
      cAaveStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
    );
    log("Claimed governance for AaveStrategy");
  }

  return cAaveStrategy;
};

/**
 * Deploy Compound Strategy which only supports DAI.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployCompoundStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dCompoundStrategyProxy = await deployWithConfirmation(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    dCompoundStrategyProxy.address
  );
  await withConfirmation(
    cCompoundStrategyProxy["initialize(address,address,bytes)"](
      dCompoundStrategy.address,
      deployerAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized CompoundStrategyProxy");
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .initialize(
        addresses.dead,
        cVaultProxy.address,
        assetAddresses.COMP,
        [assetAddresses.USDC, assetAddresses.USDT],
        [assetAddresses.cUSDC, assetAddresses.cUSDT],
        await getTxOpts()
      )
  );
  log("Initialized CompoundStrategy");

  //
  // Governance
  //
  await withConfirmation(
    cCompoundStrategy
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`CompoundStrategy transferGovernance(${governorAddr} called`);

  const propDescription = "Compound strategy governor change";
  const propArgs = await proposeArgs([
    {
      contract: cCompoundStrategy,
      signature: "claimGovernance()",
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute a governance proposal to claim governance."
    );
    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    await withConfirmation(
      cCompoundStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
    );
    log("Claimed governance for AaveStrategy");
  }

  return cCompoundStrategy;
};

/**
 * Deploy the MixOracle and initialise it with Chainlink and OpenOracle sources.
 */
const deployOracles = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const oracleAddresses = await getOracleAddresses(deployments);
  log(`Using oracle addresses ${JSON.stringify(oracleAddresses, null, 2)}`);

  // Deploy the Chainlink oracle
  await deployWithConfirmation("ChainlinkOracle", [
    oracleAddresses.chainlink.ETH_USD,
  ]);
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.DAI_ETH,
        "DAI",
        false,
        await getTxOpts()
      )
  );
  log("Registered Chainlink feed DAI/ETH");
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.USDC_ETH,
        "USDC",
        false,
        await getTxOpts()
      )
  );

  log("Registered Chainlink feed USDC/ETH");
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .registerFeed(
        oracleAddresses.chainlink.USDT_ETH,
        "USDT",
        false,
        await getTxOpts()
      )
  );
  log("Registered Chainlink feed USDT/ETH");

  // Deploy MixOracle.
  // Note: the args to the MixOracle are as follow:
  //  - for live the bounds are 1.3 - 0.7
  //  - for testing the bounds are 1.6 - 0.5
  const maxMinDrift = isMainnetOrFork ? [13e7, 7e7] : [16e7, 5e7];
  await deployWithConfirmation("MixOracle", maxMinDrift);
  const mixOracle = await ethers.getContract("MixOracle");
  log("Deployed MixOracle");

  // ETH->USD oracles
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerEthUsdOracle(chainlinkOracle.address, await getTxOpts())
  );
  log("Registered ETH USD oracle with MixOracle");

  // Token->ETH oracles
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDC",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered USDC token oracles with MixOracle");
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "USDT",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered USDT token oracles with MixOracle");
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .registerTokenOracles(
        "DAI",
        [chainlinkOracle.address],
        [oracleAddresses.openOracle],
        await getTxOpts()
      )
  );
  log("Registered DAI token oracles with MixOracle");

  //
  // Governance
  //
  await withConfirmation(
    mixOracle
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log("MixOracle transferGovernance called");
  await withConfirmation(
    chainlinkOracle
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log("ChainlinkOracle transferGovernance called");

  const propDescription = "Oracles governor change";
  const propArgs = await proposeArgs([
    {
      contract: mixOracle,
      signature: "claimGovernance()",
    },
    {
      contract: chainlinkOracle,
      signature: "claimGovernance()",
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute a governance proposal to claim governance."
    );
    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    await withConfirmation(
      mixOracle.connect(sGovernor).claimGovernance(await getTxOpts())
    );
    log("MixOracle claimGovernance called");
    await withConfirmation(
      chainlinkOracle.connect(sGovernor).claimGovernance(await getTxOpts())
    );
    log("ChainlinkOracle claimGovernance called");
  }
};

const deployVault = async () => {
  const { deployerAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // Proxy
  const dVaultProxy = await deployWithConfirmation("VaultProxy");
  log("Deployed Vault proxy", dVaultProxy.address);

  // Main contracts
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  log("Deployed Vault contracts");

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cMixOracle = await ethers.getContract("MixOracle");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      deployerAddr,
      [],
      await getTxOpts()
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .initialize(cMixOracle.address, cOUSDProxy.address, await getTxOpts())
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy
      .connect(sDeployer)
      .upgradeTo(dVaultCore.address, await getTxOpts())
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAdminImpl(dVaultAdmin.address, await getTxOpts())
  );
  log("Initialized VaultAdmin implementation");
};

const upgradeAndResetOUSD = async () => {
  const { governorAddr, v1GovernorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Temporary OUSD for running a reset
  const dOUSDReset = await deployWithConfirmation("OUSDReset");
  // Main OUSD
  const dOUSD = await deployWithConfirmation("OUSD");

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSDReset = await ethers.getContractAt(
    "OUSDReset",
    cOUSDProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // Proposal for the old governor to transfer governance to the new governor.
  const propTransferGovDescription = "OUSD governance transfer";
  const propTransferGovArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "transferGovernance(address)",
      args: [governorAddr],
    },
  ]);

  // Proposal for the new governor to:
  // - claimGovernance
  // - upgradeTo OUSDReset
  // - call reset()
  // - call setVaultAddress()
  // - upgradeTo OUSD
  const propResetDescription = "OUSD Reset";
  const propResetArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSDReset.address],
    },
    {
      contract: cOUSDReset,
      signature: "reset()",
    },
    {
      contract: cOUSDReset,
      signature: "setVaultAddress(address)",
      args: [cVaultProxy.address],
    },
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSD.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute the following governance proposals:"
    );

    log(`Governor address: ${v1GovernorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propTransferGovArgs, null, 2));

    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propResetArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposals and execution flow that takes place on Mainnet.
    await executeProposal(
      propTransferGovArgs,
      propTransferGovDescription,
      true
    );
    await executeProposal(propResetArgs, propResetDescription);
  } else {
    await withConfirmation(
      cOUSDProxy
        .connect(sGovernor)
        .upgradeTo(dOUSDReset.address, await getTxOpts())
    );
    log("Upgraded OUSD to reset implementation");

    await withConfirmation(
      cOUSDReset
        .connect(sGovernor)
        .setVaultAddress(cVaultProxy.address, await getTxOpts())
    );
    await withConfirmation(cOUSDReset.connect(sGovernor).reset());
    log("Called reset on OUSD");

    await withConfirmation(
      cOUSDProxy.connect(sGovernor).upgradeTo(dOUSD.address, await getTxOpts())
    );
    log("Upgraded OUSD to standard implementation");
  }
};

const configureVault = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );

  // Set Uniswap addr
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setUniswapAddr(
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        await getTxOpts()
      )
  );
  log("Set Uniswap address");

  // Set strategist addr
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setStrategistAddr(
        "0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC",
        await getTxOpts()
      )
  );
  log("Set strategist address");

  // Set Vault buffer
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setVaultBuffer(utils.parseUnits("2", 16), await getTxOpts())
  );
  log("set vault buffer");

  // Set Redeem fee BPS
  await withConfirmation(
    cVault.connect(sDeployer).setRedeemFeeBps(50),
    await getTxOpts()
  );
  log("Set redeem free bps");

  // Set up supported assets for Vault
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .supportAsset(assetAddresses.DAI, await getTxOpts())
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .supportAsset(assetAddresses.USDT, await getTxOpts())
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .supportAsset(assetAddresses.USDC, await getTxOpts())
  );
  log("Added USDC asset to Vault");

  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  // Approve strategies
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .approveStrategy(cAaveStrategyProxy.address, await getTxOpts())
  );
  log("Approved Aave strategy");
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .approveStrategy(cCompoundStrategyProxy.address, await getTxOpts())
  );
  log("Approved Compound strategy");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        assetAddresses.DAI,
        cAaveStrategyProxy.address,
        await getTxOpts()
      )
  );
  log("Set asset default strategy for DAI");

  // Set up the default strategy for each asset
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        assetAddresses.USDC,
        cCompoundStrategyProxy.address,
        await getTxOpts()
      )
  );
  log("Set asset default strategy for USDC");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        assetAddresses.USDT,
        cCompoundStrategyProxy.address,
        await getTxOpts()
      )
  );
  log("Set asset default strategy for USDT");

  //
  // Transfer Governance to the governor address from the deployer
  //
  await withConfirmation(
    cVault
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`Vault transferGovernance(${governorAddr} called`);

  const propDescription = "Vault governor change";
  const propArgs = await proposeArgs([
    {
      contract: cVault,
      signature: "claimGovernance()",
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute a governance proposal to claim governance."
    );
    log(`Governor address: ${governorAddr}`);
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    await withConfirmation(
      cVault
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance(await getTxOpts())
    );
    log("Claimed governance for Vault");
  }
};

// Multisig requirements for mainnet
//
// - AaveStrategy claimGovernance()
// - CompoundStrategy claimGovernance()
// - MixOracle claimGovernance()
// - ChainlinkOracle claimGovernance()
// - Vault claimGovernance()
//
// - OUSD transferGovernance to new governor
// - OUSD claimGovernance
// - OUSDProxy upgradeTo OUSDReset
// - OUSDReset reset()
// - OUSDProxy upgradeTo OUSD

const main = async () => {
  console.log(`Running ${deployName} deployment...`);
  await deployOracles();
  await deployVault();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await configureVault();
  await upgradeAndResetOUSD();
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["002_upgrade_vault", "003_governor"];
main.skip = () => !isMainnet || isFork;

module.exports = main;
