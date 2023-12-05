const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { oethUnits } = require("../test/helpers");
const { utils } = require("ethers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "082_frax_convex_strategy",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, getTxOpts, withConfirmation }) => {
    const { deployerAddr, timelockAddr, strategistAddr } =
      await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current OETH Vault contracts
    const cVault = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.OETHVaultProxy
    );
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      addresses.mainnet.OETHHarvesterProxy
    );

    // 1. Deploy FXS price feed
    await deployWithConfirmation(
      "FXS_ETHPriceFeedPair",
      [
        addresses.mainnet.chainlinkFXS_USD, // _addressFeed0
        addresses.mainnet.chainlinkETH_USD, // _addressFeed1
        false, // _reverseFeed0
        true, // _reverseFeed1
      ],
      "PriceFeedPair"
    );

    const fxsPriceFeed = await ethers.getContract("FXS_ETHPriceFeedPair");
    console.log("FXS_ETHPriceFeedPair address: ", fxsPriceFeed.address);

    const auraPriceFeed = await ethers.getContract("AuraWETHPriceFeed");
    console.log("AuraWETHPriceFeed address: ", auraPriceFeed.address);

    // 2. Deploy OETHOracleRouter
    await deployWithConfirmation("OETHOracleRouter", [
      auraPriceFeed.address,
      fxsPriceFeed.address,
    ]);
    const dOETHRouter = await ethers.getContract("OETHOracleRouter");
    console.log("new OETHOracleRouter address: ", dOETHRouter.address);

    // 2.1. Cache decimals on OETHOracleRouter
    for (const asset of [
      addresses.mainnet.CRV,
      addresses.mainnet.CVX,
      addresses.mainnet.AURA,
      addresses.mainnet.BAL,
      addresses.mainnet.stETH,
      addresses.mainnet.rETH,
      addresses.mainnet.frxETH,
      addresses.mainnet.FXS,
    ]) {
      await withConfirmation(
        dOETHRouter.cacheDecimals(asset, await getTxOpts())
      );
    }

    console.log("Decimals on OETH router cached");

    // 3. Deploy strategy proxy
    const dFraxConvexWethStrategyProxy = await deployWithConfirmation(
      "FraxConvexWethStrategyProxy"
    );
    const cFraxConvexWethStrategyProxy = await ethers.getContract(
      "FraxConvexWethStrategyProxy"
    );

    // 4. Deploy strategy implementation
    const dFraxConvexStrategy = await deployWithConfirmation(
      "FraxConvexStrategy",
      [
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          2, //assets in the Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve LP token
        ],
        [
          // stkcvxfrxeth-ng-f-frax
          addresses.mainnet.FraxStakedConvexWeth,
          // locked stkcvxfrxeth-ng-f-frax
          addresses.mainnet.LockedFraxStakedConvexWeth,
        ],
      ]
    );
    const cFraxConvexStrategy = await ethers.getContractAt(
      "FraxConvexStrategy",
      dFraxConvexWethStrategyProxy.address
    );

    // 5. Initialize the new Curve frxETH/WETH strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cFraxConvexStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX, addresses.mainnet.FXS],
        [addresses.mainnet.WETH, addresses.mainnet.frxETH],
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.CurveFrxEthWethPool,
        ],
      ]
    );
    console.log("About to initialize Frax Convex frxETH/WETH Strategy");

    // prettier-ignore
    await withConfirmation(
      cFraxConvexWethStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dFraxConvexStrategy.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized Frax Convex frxETH/WETH Strategy");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Frax Convex frxETH/WETH Strategy.",
      actions: [
        // 1. Approve the new strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cFraxConvexStrategy.address],
        },
        // 2. Add the new strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cFraxConvexStrategy.address, true],
        },
        // 3. Set the harvester address on the new strategy
        {
          contract: cFraxConvexStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
        // 4. Set OETH Oracle Router on Vault
        {
          contract: cVault,
          signature: "setPriceProvider(address)",
          args: [dOETHRouter.address],
        },
        // 5. Configure OETH Harvester to swap FXS with Curve
        {
          contract: cHarvester,
          signature:
            "setRewardTokenConfig(address,(uint16,uint16,address,bool,uint8,uint256),bytes)",
          args: [
            addresses.mainnet.FXS,
            {
              allowedSlippageBps: 300,
              harvestRewardBps: 200,
              swapPlatform: 1, // Uniswap V3
              swapPlatformAddr: addresses.mainnet.uniswapV3Router,
              liquidationLimit: oethUnits("1500"),
              doSwapRewardToken: true,
            },
            utils.solidityPack(
              ["address", "uint24", "address"],
              [addresses.mainnet.FXS, 10000, addresses.mainnet.WETH]
            ),
          ],
        },
      ],
    };
  }
);
