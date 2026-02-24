const { parseUnits } = require("ethers").utils;
const { isMainnetOrFork } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
const { replaceContractAt } = require("../../utils/hardhat");
const { hardhatSetBalance } = require("../../test/_fund");

const {
  abi: FACTORY_ABI,
  bytecode: FACTORY_BYTECODE,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");

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

  await deploy("MockUniswapV3Factory", {
    from: deployerAddr,
    contract: {
      abi: FACTORY_ABI,
      bytecode: FACTORY_BYTECODE,
    },
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

  await deploy("MockSafeContract", { from: deployerAddr });

  console.log("000_mock deploy done.");

  return true;
};

deployMocks.id = "000_mock";
deployMocks.tags = ["mocks", "unit_tests"];
deployMocks.skip = () => isMainnetOrFork;

module.exports = deployMocks;
