const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { isFork, isSonic, oethUnits } = require("../../test/helpers");

const deployMocks = async () => {
  await deployWithConfirmation("MockWS", []);
  await deployWithConfirmation("MockSFC", []);
};

const deployOracleRouter = async () => {
  const cWS = await ethers.getContract("MockWS");

  await deployWithConfirmation("MockOracleRouter");
  const cOracleRouter = await ethers.getContract("MockOracleRouter");

  const wsFeed = await deployWithConfirmation(
    "MockPriceFeedWS",
    [oethUnits("1"), 18],
    "MockChainlinkOracleFeed"
  );

  await cOracleRouter.setFeed(cWS.address, wsFeed.address, 24 * 60 * 60);
};

const deployCore = async () => {
  const { governorAddr, deployerAddr, strategistAddr } =
    await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWS = await ethers.getContract("MockWS");

  // Proxies
  await deployWithConfirmation("OSonicProxy");
  await deployWithConfirmation("WOSonicProxy");
  await deployWithConfirmation("OSonicVaultProxy");

  const cOSonicProxy = await ethers.getContract("OSonicProxy");
  const cWOSonicProxy = await ethers.getContract("WOSonicProxy");
  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Core contracts
  const dOSonic = await deployWithConfirmation("OSonic");
  const dWOSonic = await deployWithConfirmation("WOSonic", [
    cOSonicProxy.address, // Base token
  ]);

  const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin", [
    cWS.address,
  ]);

  // Get contract instances
  const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);
  const cWOSonic = await ethers.getContractAt("WOSonic", cWOSonicProxy.address);
  const cOSonicVault = await ethers.getContractAt(
    "IVault",
    cOSonicVaultProxy.address
  );

  // Init OSonic
  const resolution = ethers.utils.parseUnits("1", 27);
  const initDataOSonic = cOSonic.interface.encodeFunctionData(
    "initialize(address,uint256)",
    [
      cOSonicVaultProxy.address, // Origin Sonic Vault
      resolution, // HighRes
    ]
  );
  // prettier-ignore
  await cOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonic.address,
      governorAddr,
      initDataOSonic
    );

  // Init OSonicVault
  const initDataOSonicVault = cOSonicVault.interface.encodeFunctionData(
    "initialize(address)",
    [
      cOSonicProxy.address, // OSonic
    ]
  );
  // prettier-ignore
  await cOSonicVaultProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonicVaultAdmin.address,
      governorAddr,
      initDataOSonicVault
    );

  // Init WOSonic
  const initDataWOSonic = cWOSonic.interface.encodeFunctionData(
    "initialize()",
    []
  );
  // prettier-ignore
  await cWOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dWOSonic.address,
      governorAddr,
      initDataWOSonic
    )

  await cOSonicVaultProxy
    .connect(sGovernor)
    .upgradeTo(dOSonicVaultAdmin.address);

  await cOSonicVault.connect(sGovernor).unpauseCapital();
  // Set withdrawal claim delay to 1 day
  await cOSonicVault.connect(sGovernor).setWithdrawalClaimDelay(86400);

  await withConfirmation(
    cOSonicVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );
};

const deployStakingStrategy = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWS = await ethers.getContract("MockWS");
  const cSFC = await ethers.getContract("MockSFC");

  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Get contract instances
  const cOSonicVault = await ethers.getContractAt(
    "IVault",
    cOSonicVaultProxy.address
  );

  // Staking Strategy
  await deployWithConfirmation("SonicStakingStrategyProxy");

  const cSonicStakingStrategyProxy = await ethers.getContract(
    "SonicStakingStrategyProxy"
  );
  const dSonicStakingStrategy = await deployWithConfirmation(
    "SonicStakingStrategy",
    [
      [cSFC.address, cOSonicVault.address], // platformAddress, VaultAddress
      cWS.address,
      cSFC.address,
    ]
  );
  const cSonicStakingStrategy = await ethers.getContractAt(
    "SonicStakingStrategy",
    cSonicStakingStrategyProxy.address
  );

  // Init the Sonic Staking Strategy
  const initSonicStakingStrategy =
    cSonicStakingStrategy.interface.encodeFunctionData("initialize()", []);
  // prettier-ignore
  await withConfirmation(
      cSonicStakingStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dSonicStakingStrategy.address,
          governorAddr,
          initSonicStakingStrategy
        )
    );
};

const deployDripper = async () => {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWS = await ethers.getContract("MockWS");
  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  await deployWithConfirmation("OSonicDripperProxy");

  const cOSonicDripperProxy = await ethers.getContract("OSonicDripperProxy");
  const dFixedRateDripper = await deployWithConfirmation("FixedRateDripper", [
    cOSonicVaultProxy.address, // VaultAddress
    cWS.address,
  ]);

  // Init the Dripper proxy
  // prettier-ignore
  await withConfirmation(
    cOSonicDripperProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dFixedRateDripper.address,
          governorAddr,
          "0x"
        )
    );
};

const main = async () => {
  await deployMocks();
  await deployOracleRouter();
  await deployCore();
  await deployStakingStrategy();
  await deployDripper();
};

main.id = "000_mock";
main.tags = ["sonic_unit_tests"];

// Only run for unit tests
main.skip = () => isFork || isSonic;

module.exports = main;
