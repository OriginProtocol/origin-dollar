const { parseUnits } = require("ethers").utils;
const { isMainnetOrFork } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
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
  // const sDeployer = await ethers.provider.getSigner(deployerAddr);

  console.log("Running 000_mock deployment...");
  console.log("Deployer address", deployerAddr);
  console.log("Governor address", governorAddr);

  // Deploy mock coins (assets)
  const assetContracts = [
    "MockUSDT",
    "MockUSDC",
    "MockUSDS",
    "MockDAI",
    "MockNonStandardToken",
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

  await deploy("MockOGN", {
    from: deployerAddr,
    args: [parseUnits("1000000000", 18)],
  });

  await deploy("DepositContractUtils", {
    args: [],
    contract: "DepositContractUtils",
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

  const usdc = await ethers.getContract("MockUSDC");

  // Deploy mock chainlink oracle price feeds.
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
  await deploy("MockChainlinkOracleFeedNonStandardToken", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 8).toString(), 8], // 1 = 1 USD, 8 digits decimal.
  });
  await deploy("MockChainlinkOracleFeedWETHETH", {
    from: deployerAddr,
    contract: "MockChainlinkOracleFeed",
    args: [parseUnits("1", 18).toString(), 18], // 1 WETH = 1 ETH , 18 digits decimal.
  });

  // Deploy mock Uniswap router
  await deploy("MockUniswapRouter", {
    from: deployerAddr,
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

  await deploy("MockBeaconProofs", { from: deployerAddr });
  await deploy("EnhancedBeaconProofs", { from: deployerAddr });
  await deploy("MockBeaconRoots", { from: deployerAddr });
  const mockBeaconRoots = await ethers.getContract("MockBeaconRoots");
  await replaceContractAt(addresses.mainnet.beaconRoots, mockBeaconRoots);

  await deploy("MockStrategy", { from: deployerAddr });
  await deploy("CCTPMessageTransmitterMock", {
    from: deployerAddr,
    args: [usdc.address],
  });
  const messageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock"
  );
  await deploy("CCTPTokenMessengerMock", {
    from: deployerAddr,
    args: [usdc.address, messageTransmitter.address],
  });
  await deploy("MockERC4626Vault", {
    from: deployerAddr,
    args: [usdc.address],
  });
  // const tokenMessenger = await ethers.getContract("CCTPTokenMessengerMock");
  // await messageTransmitter
  //   .connect(sDeployer)
  //   .setCCTPTokenMessenger(tokenMessenger.address);

  console.log("000_mock deploy done.");

  return true;
};

deployMocks.id = "000_mock";
deployMocks.tags = ["mocks", "unit_tests"];
deployMocks.skip = () => isMainnetOrFork;

module.exports = deployMocks;
