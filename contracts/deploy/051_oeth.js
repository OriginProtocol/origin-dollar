const { deploymentWithGuardianGovernor } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const hre = require("hardhat");
const { BigNumber, utils } = require("ethers");
const {
  getAssetAddresses,
  getOracleAddresses,
  isMainnet,
  isFork,
  isMainnetOrFork,
} = require("../test/helpers.js");

// 5/8 multisig
const guardianAddr = addresses.mainnet.Guardian;

module.exports = deploymentWithGuardianGovernor(
  { deployName: "051_oeth", forceDeploy: true },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // actions = actions.concat(actions2)
    let actions = await deployCore({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    await deployDripper({ deployWithConfirmation, withConfirmation, ethers });

    actions = actions.concat(
      await deployFraxETHStrategy({
        deployWithConfirmation,
        withConfirmation,
        ethers,
      })
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy OETH Vault, Token, Strategies, Harvester and the Dripper",
      actions,
    };
  }
);

/**
 * Deploy the core contracts (Vault and OETH).
 */
const deployCore = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const assetAddresses = await getAssetAddresses(hre.deployments);
  console.log(
    `Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`
  );

  // Proxies
  await deployWithConfirmation("OETHVaultProxy");
  await deployWithConfirmation("OETHProxy");
  await deployWithConfirmation("OracleRouter");

  // Main contracts
  const dOETH = await deployWithConfirmation("OETH");
  /* We have wrapper contracts for all of the contracts that are shared between the
   * protocols. The reason for that is that we want separate deployment artifacts and
   * separate storage slot layouts for these shared contracts.
   */
  const dVault = await deployWithConfirmation("OETHVault", null, null, false);
  const dVaultCore = await deployWithConfirmation("OETHVaultCore");
  const dVaultAdmin = await deployWithConfirmation("OETHVaultAdmin");

  // Get contract instances
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

  await withConfirmation(
    cOETHProxy
      .connect(sDeployer)
      ["initialize(address,address,bytes)"](dOETH.address, deployerAddr, [])
  );
  console.log("Initialized OETHProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy
      .connect(sDeployer)
      ["initialize(address,address,bytes)"](dVault.address, deployerAddr, [])
  );
  console.log("Initialized OETHVaultProxy");

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .initialize(cOracleRouter.address, cOETHProxy.address)
  );
  console.log("Initialized OETHVault");

  await withConfirmation(
    cVaultProxy.connect(sDeployer).upgradeTo(dVaultCore.address)
  );
  console.log("Upgraded OETHVaultCore implementation");

  await withConfirmation(
    cVault.connect(sDeployer).setAdminImpl(dVaultAdmin.address)
  );

  await withConfirmation(
    // TODO confirm this value
    cVault
      .connect(sDeployer)
      .setAutoAllocateThreshold(utils.parseUnits("10", 18))
  );
  await withConfirmation(
    // TODO confirm this value
    cVault.connect(sDeployer).setRebaseThreshold(utils.parseUnits("2", 18))
  );

  await withConfirmation(
    // TODO is it ok to start with unpaused capital?
    cVault.connect(sDeployer).unpauseCapital()
  );

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.mainnet.frxETH, 0)
  );

  console.log("Initialized OETHVaultAdmin implementation");

  // Initialize OETH
  await withConfirmation(
    cOETH.connect(sDeployer).initialize(
      "Origin Ether", // the name?
      "OETH",
      cVaultProxy.address,
      utils.parseUnits("1", 27).sub(BigNumber.from(1))
    )
  );

  console.log("Initialized OETH");

  await withConfirmation(
    cVaultProxy.connect(sDeployer).transferGovernance(guardianAddr)
  );

  await withConfirmation(
    cOETHProxy.connect(sDeployer).transferGovernance(guardianAddr)
  );

  console.log("Governance transfer initialized");

  // return actions to be executed by the Governor
  return [
    {
      // Claim Vault governance
      contract: cVaultProxy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      // Claim OETH governance
      contract: cOETHProxy,
      signature: "claimGovernance()",
      args: [],
    },
  ];
};

const deployDripper = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const assetAddresses = await getAssetAddresses(deployments);
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");

  // Deploy Dripper Impl
  const dDripper = await deployWithConfirmation("OETHDripper", [
    cVaultProxy.address,
    assetAddresses.WETH,
  ]);
  const dDripperProxy = await deployWithConfirmation("OETHDripperProxy");
  // Deploy Dripper Proxy
  cDripperProxy = await ethers.getContract("OETHDripperProxy");
  await withConfirmation(
    cDripperProxy
      .connect(sDeployer)
      ["initialize(address,address,bytes)"](dDripper.address, guardianAddr, [])
  );
};

/**
 * Deploy Frax ETH Strategy
 */
const deployFraxETHStrategy = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

  const dFraxETHStrategyProxy = await deployWithConfirmation(
    "FraxETHStrategyProxy"
  );
  const cFraxETHStrategyProxy = await ethers.getContract(
    "FraxETHStrategyProxy"
  );
  const dFraxETHStrategy = await deployWithConfirmation("Generalized4626Strategy");
  const cFraxETHStrategy = await ethers.getContractAt(
    "Generalized4626Strategy",
    dFraxETHStrategyProxy.address
  );
  await withConfirmation(
    cFraxETHStrategyProxy
      .connect(sDeployer)
      ["initialize(address,address,bytes)"](
        dFraxETHStrategy.address,
        deployerAddr,
        []
      )
  );

  console.log("Initialized FraxETHStrategyProxy");
  await withConfirmation(
    cFraxETHStrategy
      .connect(sDeployer)
      .initialize(
        addresses.mainnet.sfrxETH,
        cVaultProxy.address,
        [],
        [addresses.mainnet.frxETH],
        [addresses.mainnet.sfrxETH]
      )
  );
  console.log("Initialized FraxETHStrategy");
  await withConfirmation(
    cFraxETHStrategy.connect(sDeployer).transferGovernance(guardianAddr)
  );
  console.log(`FraxETHStrategy transferGovernance(${guardianAddr} called`);

  await withConfirmation(
    cVault.connect(sDeployer).approveStrategy(cFraxETHStrategyProxy.address)
  );

  return [
    {
      // Claim Vault governance
      contract: cFraxETHStrategy,
      signature: "claimGovernance()",
      args: [],
    },
  ];
};

