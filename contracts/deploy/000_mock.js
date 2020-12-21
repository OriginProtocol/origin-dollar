const { parseUnits } = require("ethers").utils;
const { isMainnetOrRinkebyOrFork } = require("../test/helpers");

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
    "MockDAI",
    "MockNonStandardToken",
    "MockWETH",
    "MockAave",
  ];
  for (const contract of assetContracts) {
    await deploy(contract, { from: deployerAddr });
  }

  await deploy("MockOGN", {
    from: deployerAddr,
    args: [parseUnits("1000000000", 18)],
  });

  // Deploy mock cTokens (Compound)
  await deploy("MockCDAI", {
    args: [(await ethers.getContract("MockDAI")).address],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCUSDC", {
    args: [(await ethers.getContract("MockUSDC")).address],
    contract: "MockCToken",
    from: deployerAddr,
  });

  await deploy("MockCUSDT", {
    args: [(await ethers.getContract("MockUSDT")).address],
    contract: "MockCToken",
    from: deployerAddr,
  });

  // Mock COMP token
  await deploy("MockCOMP", {
    from: deployerAddr,
  });

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    from: governorAddr,
  });

  // Deploy mock uniswap pair oracles.
  const weth = await ethers.getContract("MockWETH");
  const dai = await ethers.getContract("MockDAI");
  const usdc = await ethers.getContract("MockUSDC");
  const usdt = await ethers.getContract("MockUSDT");
  const ogn = await ethers.getContract("MockOGN");

  // Deploy mock aTokens (Aave)
  // MockAave is the mock lendingPool
  const lendingPool = await ethers.getContract("MockAave");
  await deploy("MockADAI", {
    args: [lendingPool.address, "Mock Aave Dai", "aDAI", dai.address],
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

  // Reserve amounts, in native token decimals. WETH, DAI use 18 decimals. USDC, USDT use 6 decimals.
  const reserve1ETH = parseUnits("1", 18);
  const reserve100DAI = parseUnits("100", 18);
  const reserve100USDC = parseUnits("100", 6);
  const reserve100USDT = parseUnits("100", 6);

  await deploy("MockUniswapPairDAI_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [dai.address, weth.address, reserve100DAI, reserve1ETH],
  });

  await deploy("MockUniswapPairUSDC_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [usdc.address, weth.address, reserve100USDC, reserve1ETH],
  });

  await deploy("MockUniswapPairUSDT_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [usdt.address, weth.address, reserve100USDT, reserve1ETH],
  });

  // Deploy mock open oracle.
  await deploy("MockOracle", { from: deployerAddr });
  const mockOracle = await ethers.getContract("MockOracle");
  await mockOracle.setPrice("ETH", parseUnits("1.0", 8));
  await mockOracle.setPrice("DAI", parseUnits("1.0", 6));
  await mockOracle.setPrice("USDC", parseUnits("1.0", 6));
  await mockOracle.setPrice("USDT", parseUnits("1.0", 6));
  await mockOracle.setPrice("TUSD", parseUnits("1.0", 6));

  // Deploy mock chainlink oracle price feeds.
  await deploy("MockChainlinkOracleFeedETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("100", 8).toString(), 8], // 1 ETH = $100 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedDAI", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.01", 18).toString(), 18], // 1 DAI = 0.01 ETH, 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedUSDT", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.01", 18).toString(), 18], // 1 USDT = 0.01 ETH, 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedUSDC", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.01", 18).toString(), 18], // 1 USDC = 0.01 ETH, 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedTUSD", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.01", 18).toString(), 18], // 1 TUSD = 0.01 ETH, 18 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedNonStandardToken", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("0.01", 18).toString(), 18], // 1 token = 0.01 ETH, 18 digits decimal.
  });

  // Deploy mock Uniswap router
  await deploy("MockUniswapRouter", {
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
    args: [[dai.address, usdc.address, usdt.address], threePoolToken.address],
  });

  await deploy("MockNonRebasing", {
    from: deployerAddr,
  });

  await deploy("MockNonRebasingTwo", {
    from: deployerAddr,
    contract: "MockNonRebasing",
  });

  console.log("000_mock deploy done.");

  return true;
};

deployMocks.id = "000_mock";
deployMocks.tags = ["mocks"];
deployMocks.skip = () => isMainnetOrRinkebyOrFork;

module.exports = deployMocks;
