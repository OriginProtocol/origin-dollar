const { parseUnits } = require("ethers").utils;

const deployMocks = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  // Deploy mock coins (assets)
  const assetContracts = [
    "MockUSDT",
    "MockTUSD",
    "MockUSDC",
    "MockDAI",
    "MockNonStandardToken",
    "MockWETH"
  ];
  for (const contract of assetContracts) {
    await deploy(contract, { from: deployerAddr });
  }

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
  const usdc = await ethers.getContract("MockUSDT");
  const usdt = await ethers.getContract("MockUSDC");

  await deploy("MockUniswapPairDAI_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [dai.address, weth.address, "100", "1"], // DAI, ETH with respective reserve of 100 and 1
  });

  await deploy("MockUniswapPairUSDC_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [usdc.address, weth.address, "100", "1"], // USDC, ETH with respective reserve of 100 and 1
  });

  await deploy("MockUniswapPairUSDT_ETH", {
    from: deployerAddr,
    contract: "MockUniswapPair",
    args: [usdt.address, weth.address, "100", "1"], // USDT, ETH with respective reserve of 100 and 1
  });

  // Deploy mock open oracle.
  await deploy("MockOracle", { from: deployerAddr });

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

  await deploy("MockNonRebasing", {
    from: deployerAddr,
  });
};

deployMocks.tags = ["mocks"];
deployMocks.skip = (env) =>
  !["localhost", "buidlerevm", "ganache", "soliditycoverage"].includes(
    env.network.name
  );

module.exports = deployMocks;
