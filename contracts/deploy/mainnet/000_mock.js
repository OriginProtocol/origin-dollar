const { parseUnits } = require("ethers").utils;
const { isMainnetOrFork } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
const { threeCRVPid } = require("../../utils/constants");
const { replaceContractAt } = require("../../utils/hardhat");
const { hardhatSetBalance } = require("../../test/_fund");

const {
  abi: FACTORY_ABI,
  bytecode: FACTORY_BYTECODE,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");

const {
  abi: ROUTER_ABI,
  bytecode: ROUTER_BYTECODE,
} = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");

const {
  abi: MANAGER_ABI,
  bytecode: MANAGER_BYTECODE,
} = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

const {
  abi: QUOTER_ABI,
  bytecode: QUOTER_BYTECODE,
} = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json");

const deployMocks = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  console.log("Running 000_mock deployment...");
  console.log("Deployer address", deployerAddr);
  console.log("Governor address", governorAddr);

  // Deploy mock coins (assets)
  const assetContracts = [
    "MockUSDT",
    "MockTUSD",
    "MockUSDC",
    "MockUSDS",
    "MockDAI",
    "MockNonStandardToken",
    "MockOGV",
    "MockAave",
    "MockRETH",
    "MockstETH",
    "MockfrxETH",
  ];
  for (const contract of assetContracts) {
    await deploy(contract, { from: deployerAddr });
  }

  await deploy("MockWETH", { from: deployerAddr });
  // Replace WETH contract with MockWETH as some contracts have the WETH address hardcoded.
  const mockWETH = await ethers.getContract("MockWETH");
  await replaceContractAt(addresses.mainnet.WETH, mockWETH);
  await hardhatSetBalance(addresses.mainnet.WETH, "999999999999999");
  const weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);

  await deploy("MocksfrxETH", {
    from: deployerAddr,
    args: [(await ethers.getContract("MockfrxETH")).address],
  });

  await deploy("MockOGN", {
    from: deployerAddr,
    args: [parseUnits("1000000000", 18)],
  });

  // Mock Comptroller
  await deploy("MockComptroller", {
    from: deployerAddr,
  });

  // Deploy mock cTokens (Compound)
  await deploy("MockCDAI", {
    args: [
      (await ethers.getContract("MockDAI")).address,
      (await ethers.getContract("MockComptroller")).address,
    ],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCUSDS", {
    args: [
      (await ethers.getContract("MockUSDS")).address,
      (await ethers.getContract("MockComptroller")).address,
    ],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("DepositContractUtils", {
    args: [],
    contract: "DepositContractUtils",
    from: deployerAddr,
  });

  await deploy("MockCUSDC", {
    args: [
      (await ethers.getContract("MockUSDC")).address,
      (await ethers.getContract("MockComptroller")).address,
    ],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCUSDT", {
    args: [
      (await ethers.getContract("MockUSDT")).address,
      (await ethers.getContract("MockComptroller")).address,
    ],
    contract: "MockCToken",
    from: deployerAddr,
  });

  // Mock COMP token
  await deploy("MockCOMP", {
    from: deployerAddr,
  });

  // Mock BAL token
  await deploy("MockBAL", {
    from: deployerAddr,
  });

  // Mock AURA token
  await deploy("MockAura", {
    from: deployerAddr,
  });

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    args: [(await ethers.getContract("MockUSDC")).address],
    from: governorAddr,
  });

  // Mock SSV token
  await deploy("MockSSV", {
    from: deployerAddr,
  });

  // Mock SSV Network
  await deploy("MockSSVNetwork", {
    from: deployerAddr,
  });

  // Mock SSV Network
  await deploy("MockDepositContract", {
    from: deployerAddr,
  });

  const usds = await ethers.getContract("MockUSDS");
  const usdc = await ethers.getContract("MockUSDC");
  const usdt = await ethers.getContract("MockUSDT");
  const dai = await ethers.getContract("MockDAI");

  // Deploy mock aTokens (Aave)
  // MockAave is the mock lendingPool
  const lendingPool = await ethers.getContract("MockAave");
  await deploy("MockADAI", {
    args: [lendingPool.address, "Mock Aave DAI", "aDAI", dai.address],
    contract: "MockAToken",
    from: deployerAddr,
  });
  lendingPool.addAToken(
    (await ethers.getContract("MockADAI")).address,
    dai.address
  );

  await deploy("MockAUSDC", {
    args: [lendingPool.address, "Mock Aave USDC", "aUSDC", usdc.address],
    contract: "MockAToken",
    from: deployerAddr,
  });
  lendingPool.addAToken(
    (await ethers.getContract("MockAUSDC")).address,
    usdc.address
  );

  await deploy("MockAUSDT", {
    args: [lendingPool.address, "Mock Aave USDT", "aUSDT", usdt.address],
    contract: "MockAToken",
    from: deployerAddr,
  });
  lendingPool.addAToken(
    (await ethers.getContract("MockAUSDT")).address,
    usdt.address
  );

  // Deploy mock chainlink oracle price feeds.
  await deploy("MockChainlinkOracleFeedDAI", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 DAI = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedUSDS", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 USDS = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedUSDT", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 USDT = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedUSDC", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 USDC = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedTUSD", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 TUSD = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedCOMP", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 COMP = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedAAVE", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 AAVE = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedCRV", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 CRV = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedCVX", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 CVX = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedNonStandardToken", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("4000", 8).toString(), 8], // 1 ETH = 4000 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedOGNETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.1", 18).toString(), 18], // 10 OGN = 1 ETH, 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedRETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1.2", 18).toString(), 18], // 1 RETH = 1.2 ETH , 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedstETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.998", 18).toString(), 18], // 1 stETH = 0.998 ETH , 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedfrxETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 18).toString(), 18], // 1 frxETH = 1 ETH , 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedWETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 18).toString(), 18], // 1 WETH = 1 ETH , 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedfrxETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 18).toString(), 18], // 1 frxETH = 1 ETH , 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedBALETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.002", 18).toString(), 18], // 500 BAL = 1 ETH , 18 digits decimal.
  });

  // Deploy mock Uniswap router
  await deploy("MockUniswapRouter", {
    from: deployerAddr,
  });

  // Deploy mock Uniswap router
  await deploy("MockBalancerVault", {
    from: deployerAddr,
  });

  // Deploy 3pool mocks
  await deploy("Mock3CRV", {
    from: deployerAddr,
  });

  // Mock CRV token
  await deploy("MockCRV", {
    from: deployerAddr,
  });

  // Mock Curve minter for minting CRV
  const mockCRV = await ethers.getContract("MockCRV");
  await deploy("MockCRVMinter", {
    from: deployerAddr,
    args: [mockCRV.address],
  });

  const threePoolToken = await ethers.getContract("Mock3CRV");

  // Mock Curve gauge for depositing LP tokens from pool
  await deploy("MockCurveGauge", {
    from: deployerAddr,
    args: [threePoolToken.address],
  });

  await deploy("MockCurvePool", {
    from: deployerAddr,
    args: [[usds.address, usdc.address, usdt.address], threePoolToken.address],
  });
  // Mock CVX token
  await deploy("MockCVX", {
    from: deployerAddr,
  });
  const mockCVX = await ethers.getContract("MockCVX");
  await deploy("MockCVXLocker", {
    from: deployerAddr,
    args: [mockCVX.address],
  });

  await deploy("MockBooster", {
    from: deployerAddr,
    args: [mockCVX.address, mockCRV.address, mockCVX.address],
  });
  const mockBooster = await ethers.getContract("MockBooster");
  await mockBooster.setPool(threeCRVPid, threePoolToken.address);

  await deploy("MockRewardPool", {
    from: deployerAddr,
    args: [
      threeCRVPid,
      threePoolToken.address,
      mockCRV.address,
      mockCVX.address,
      mockCRV.address,
    ],
  });

  await deploy("MockAAVEToken", {
    from: deployerAddr,
    args: [],
  });

  const mockAaveToken = await ethers.getContract("MockAAVEToken");

  await deploy("MockStkAave", {
    from: deployerAddr,
    args: [mockAaveToken.address],
  });

  const mockStkAave = await ethers.getContract("MockStkAave");

  await deploy("MockAaveIncentivesController", {
    from: deployerAddr,
    args: [mockStkAave.address],
  });

  await deploy("MockNonRebasing", {
    from: deployerAddr,
  });

  await deploy("MockNonRebasingTwo", {
    from: deployerAddr,
    contract: "MockNonRebasing",
  });

  const factory = await deploy("MockUniswapV3Factory", {
    from: deployerAddr,
    contract: {
      abi: FACTORY_ABI,
      bytecode: FACTORY_BYTECODE,
    },
  });

  await deploy("MockUniswapV3Router", {
    from: deployerAddr,
    contract: {
      abi: ROUTER_ABI,
      bytecode: ROUTER_BYTECODE,
    },
    args: [factory.address, weth.address],
  });

  await deploy("MockUniswapV3NonfungiblePositionManager", {
    from: deployerAddr,
    contract: {
      abi: MANAGER_ABI,
      bytecode: MANAGER_BYTECODE,
    },
    /*
     * The last constructor argument should be of type "NonfungibleTokenPositionDescriptor", but
     * the bytecode of that seems to be corrupt - hardhat doesn't want to deploy it. Shouldn't be a
     * problem as long as we don't call the `tokenUri` function:
     * https://github.com/Uniswap/uniswap-v3-periphery/blob/79c708f357df69f7b3a494467e0f501810a11146/contracts/NonfungiblePositionManager.sol#L189-L192
     *
     */
    args: [factory.address, weth.address, factory.address],
  });

  await deploy("MockUniswapV3Quoter", {
    from: deployerAddr,
    contract: {
      abi: QUOTER_ABI,
      bytecode: QUOTER_BYTECODE,
    },
    args: [factory.address, weth.address],
  });

  const frxETH = await ethers.getContract("MockfrxETH");
  const sfrxETH = await ethers.getContract("MocksfrxETH");
  await deploy("MockFrxETHMinter", {
    from: deployerAddr,
    args: [frxETH.address, sfrxETH.address],
  });
  // Replace frxETHMinter
  await replaceContractAt(
    addresses.mainnet.FraxETHMinter,
    await ethers.getContract("MockFrxETHMinter")
  );

  await deploy("MockSwapper", {
    from: deployerAddr,
  });
  await deploy("Mock1InchSwapRouter", {
    from: deployerAddr,
  });

  await deploy("MockOracleWeightedPool", {
    from: deployerAddr,
  });

  await deploy("MockBeaconProofs", { from: deployerAddr });
  await deploy("EnhancedBeaconProofs", { from: deployerAddr });
  await deploy("MockBeaconRoots", { from: deployerAddr });
  const mockBeaconRoots = await ethers.getContract("MockBeaconRoots");
  await replaceContractAt(addresses.mainnet.beaconRoots, mockBeaconRoots);

  console.log("000_mock deploy done.");

  return true;
};

deployMocks.id = "000_mock";
deployMocks.tags = ["mocks", "unit_tests"];
deployMocks.skip = () => isMainnetOrFork;

module.exports = deployMocks;
