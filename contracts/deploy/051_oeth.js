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
  { deployName: "051_oeth" },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // actions = actions.concat(actions2)
    let actions = await deployCore({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    // await deployDripper({ deployWithConfirmation, withConfirmation, ethers });

    await deployZapper({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

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
  const { deployerAddr, strategistAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const assetAddresses = await getAssetAddresses(hre.deployments);
  console.log(
    `Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`
  );

  // Proxies
  await deployWithConfirmation("OETHVaultProxy");
  await deployWithConfirmation("OETHOracleRouter");

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
  // OETH proxy has already been deployed by deploy 049
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETH = await ethers.getContractAt("OETH", cOETHProxy.address);
  const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

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
      .initialize(cOETHOracleRouter.address, cOETHProxy.address)
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
    cVault
      .connect(sDeployer)
      .setAutoAllocateThreshold(utils.parseUnits("10", 18))
  );

  await withConfirmation(
    cVault.connect(sDeployer).setRebaseThreshold(utils.parseUnits("1", 18))
  );

  await withConfirmation(
    cVault.connect(sDeployer).setMaxSupplyDiff(utils.parseUnits("3", 16))
  );

  await withConfirmation(
    cVault.connect(sDeployer).setRedeemFeeBps(50) // 50 BPS = 0.5%
  );

  await withConfirmation(
    cVault.connect(sDeployer).setStrategistAddr(strategistAddr)
  );

  await withConfirmation(
    cVault.connect(sDeployer).setTrusteeAddress(strategistAddr)
  );

  await withConfirmation(
    cVault.connect(sDeployer).setTrusteeFeeBps(2000) // 2000 BPS = 20%
  );

  await withConfirmation(cVault.connect(sDeployer).unpauseCapital());

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.mainnet.frxETH, 0)
  );

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.mainnet.WETH, 0)
  );

  console.log("Initialized OETHVaultAdmin implementation");

  await withConfirmation(
    cVaultProxy.connect(sDeployer).transferGovernance(guardianAddr)
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
    {
      // Upgrade OETH proxy
      contract: cOETHProxy,
      signature: "upgradeTo(address)",
      args: [dOETH.address],
    },
    {
      // Initialize OETH in the proxy storage slot space
      contract: cOETH,
      signature: "initialize(string,string,address,uint256)",
      // TODO: Verify name is ok
      args: [
        "Origin Ether",
        "OETH",
        cVaultProxy.address,
        utils.parseUnits("1", 27).sub(BigNumber.from(1)),
      ],
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

const deployZapper = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");

  await deployWithConfirmation("OETHZapper", [
    cOETHProxy.address,
    cVaultProxy.address,
  ]);
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
  const dFraxETHStrategy = await deployWithConfirmation(
    "Generalized4626Strategy"
  );
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
