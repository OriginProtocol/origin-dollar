const { deploymentWithGuardianGovernor } = require("../../utils/deploy.js");
const addresses = require("../../utils/addresses.js");
const hre = require("hardhat");
const { BigNumber, utils } = require("ethers");
const { getAssetAddresses } = require("../../test/helpers.js");

// 5/8 multisig
const guardianAddr = addresses.base.governor;

module.exports = deploymentWithGuardianGovernor(
  { deployName: "001_core_base" },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    let actions = await deployCore({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    // Governance Actions
    // ----------------
    return {
      name: "Deploy OETH Vault",
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
  //await deployWithConfirmation("OETHOracleRouter");
  await deployWithConfirmation(
    "PriceFeedPair",
    [
      addresses.base.aeroUsdPriceFeed,
      addresses.base.ethUsdPriceFeed,
      false,
      true,
    ],
    "PriceFeedPair"
  );
  const priceFeedPair = await ethers.getContract("PriceFeedPair");
  oracleContract = "BaseOETHOracleRouter";
  contractName = "BaseOETHOracleRouter";
  args = [priceFeedPair.address];


await deployWithConfirmation(contractName, args, oracleContract);

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
  const cOETHOracleRouter = await ethers.getContract("BaseOETHOracleRouter");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dVault.address, deployerAddr, [])
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
    cVault.connect(sDeployer).setTrusteeFeeBps(0) // 0%
  );

  await withConfirmation(cVault.connect(sDeployer).unpauseCapital());

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.base.WETH, 0)
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

