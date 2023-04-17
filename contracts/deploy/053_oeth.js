const { deploymentWithGuardianGovernor } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const hre = require("hardhat");
const { BigNumber, utils } = require("ethers");
const { parseUnits } = utils;
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
  { deployName: "053_oeth" },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

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

const deployDevOracle = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const deploy = hre.deployments.deploy;

  await deployWithConfirmation("OracleRouterDev");
  const oracleRouter = await ethers.getContract("OracleRouterDev");
  const oracleAddresses = await getOracleAddresses(deployments);
  const assetAddresses = await getAssetAddresses(deployments);

  // Deploy mock chainlink oracle price feeds.
  const dDaiFeed = await deploy("MockChainlinkOracleFeedDAI", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 DAI = 1 USD, 8 digits decimal.
  });
  const dUsdtFeed = await deploy("MockChainlinkOracleFeedUSDT", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 USDT = 1 USD, 8 digits decimal.
  });
  const dUSDCFeed = await deploy("MockChainlinkOracleFeedUSDC", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 USDC = 1 USD, 8 digits decimal.
  });
  const dTusdFeed = await deploy("MockChainlinkOracleFeedTUSD", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 TUSD = 1 USD, 8 digits decimal.
  });
  const dCompFeed = await deploy("MockChainlinkOracleFeedCOMP", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 COMP = 1 USD, 8 digits decimal.
  });
  const dAaveFeed = await deploy("MockChainlinkOracleFeedAAVE", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 AAVE = 1 USD, 8 digits decimal.
  });
  const dCrvFeed = await deploy("MockChainlinkOracleFeedCRV", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 CRV = 1 USD, 8 digits decimal.
  });
  const dCvxFeed = await deploy("MockChainlinkOracleFeedCVX", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 CVX = 1 USD, 8 digits decimal.
  });
  const dNonStandardTokenFeed = await deploy("MockChainlinkOracleFeedNonStandardToken", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 = 1 USD, 8 digits decimal.
  });
  const dEthFeed = await deploy("MockChainlinkOracleFeedETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("4000", 8).toString(), 8], // 1 ETH = 4000 USD, 8 digits decimal.
  });
  const dOgnEthFeed = await deploy("MockChainlinkOracleFeedOGNETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.1", 18).toString(), 18], // 10 OGN = 1 ETH, 18 digits decimal.
  });
  const dRethEthFeed = await deploy("MockChainlinkOracleFeedRETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1.2", 18).toString(), 18], // 1 RETH = 1.2 ETH , 18 digits decimal.
  });
  const dstEthFeed = await deploy("MockChainlinkOracleFeedstETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 18).toString(), 18], // 1 stETH = 1 ETH , 18 digits decimal.
  });

  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.DAI, dDaiFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.USDC, dUSDCFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.USDT, dUsdtFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.COMP, dCompFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.AAVE, dAaveFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.CRV, dCrvFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.CVX, dCvxFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.RETH, dRethEthFeed.address)
  );
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.stETH, dstEthFeed.address)
  );

  const FIXED_PRICE = "0x0000000000000000000000000000000000000001";
  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.frxETH, FIXED_PRICE)
  );

  await withConfirmation(
    oracleRouter
      .connect(sDeployer)
      .setFeed(assetAddresses.WETH, FIXED_PRICE)
  );


  return oracleRouter

  console.log("ROUTER deployed and initialised at: ", oracleRouter.address);
};


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
  //const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");
  const cOETHOracleRouter = await deployDevOracle({
    deployWithConfirmation,
    withConfirmation,
    ethers
  })

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

  await withConfirmation(
    // 1 stands for GETEXCHANGERATE unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.mainnet.rETH, 1)
  );

  await withConfirmation(
    // 0 stands for DECIMAL unit conversion
    cVault.connect(sDeployer).supportAsset(addresses.mainnet.stETH, 0)
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

  console.log("Add to vault and set as default strategy for frxeth");
  await withConfirmation(
    cVault.connect(sDeployer).approveStrategy(cFraxETHStrategyProxy.address)
  );

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(
        addresses.mainnet.frxETH,
        cFraxETHStrategyProxy.address
      )
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
