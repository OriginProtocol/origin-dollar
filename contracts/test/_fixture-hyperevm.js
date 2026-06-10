const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isHyperEVMFork, usdcUnits } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const { deployWithConfirmation } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const erc20Abi = require("./abi/erc20.json");

let snapshotId;

const defaultFixture = async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isHyperEVMFork && isFork) {
    // Only works for HyperEVM fork
    return;
  }

  const { deployerAddr } = await getNamedAccounts();

  if (isFork) {
    await impersonateAndFund(deployerAddr);
  }

  await deployments.fixture(["hyperevm"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const { timelockAddr, multichainStrategistAddr } = await getNamedAccounts();

  const admin = await impersonateAndFund(addresses.hyperevm.admin);
  admin.address = addresses.hyperevm.admin;

  const strategist = await impersonateAndFund(multichainStrategistAddr);
  strategist.address = multichainStrategistAddr;

  const timelock = await ethers.getContractAt(
    "ITimelockController",
    timelockAddr
  );

  if (isFork) {
    await impersonateAndFund(timelockAddr);
  }

  const crossChainRemoteStrategy = await ethers.getContractAt(
    "CrossChainRemoteStrategy",
    addresses.hyperevm.CrossChainRemoteStrategy
  );

  return {
    admin,
    strategist,
    timelock,
    crossChainRemoteStrategy,
  };
};

const defaultHyperEVMFixture = deployments.createFixture(defaultFixture);

const crossChainHyperEVMFixture = deployments.createFixture(async () => {
  const fixture = await defaultHyperEVMFixture();

  const signers = await hre.ethers.getSigners();
  const [, , , , rafael] = signers.slice(4); // Skip first 4 to avoid conflict

  const usdc = await ethers.getContractAt(erc20Abi, addresses.hyperevm.USDC);

  // Fund rafael with USDC using the FiatToken masterMinter pattern
  const usdcWithMinter = await ethers.getContractAt(
    [
      "function mint(address to, uint256 amount) external",
      "function configureMinter(address minter, uint256 minterAmount) external",
      "function masterMinter() external view returns (address)",
    ],
    addresses.hyperevm.USDC
  );
  const masterMinterAddress = await usdcWithMinter.masterMinter();
  const usdcMinter = await impersonateAndFund(masterMinterAddress);
  await usdcWithMinter
    .connect(usdcMinter)
    .configureMinter(rafael.address, usdcUnits("100000000"));
  await usdcWithMinter
    .connect(rafael)
    .mint(rafael.address, usdcUnits("1000000"));

  // Deploy mock CCTP contracts
  await deployWithConfirmation("CCTPMessageTransmitterMock2", [
    usdc.address,
    19, // HyperEVM CCTP source domain
  ]);
  const mockMessageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock2"
  );
  await deployWithConfirmation("CCTPTokenMessengerMock", [
    usdc.address,
    mockMessageTransmitter.address,
  ]);
  await mockMessageTransmitter.setCCTPTokenMessenger(
    addresses.CCTPTokenMessengerV2
  );

  // The cross-chain operator is re-pointed during the Talos signer migration
  // (deploy 003), so read it from the strategy instead of hardcoding a relayer.
  const relayer = await impersonateAndFund(
    await fixture.crossChainRemoteStrategy.operator()
  );

  return {
    ...fixture,
    rafael,
    usdc,
    mockMessageTransmitter,
    relayer,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultHyperEVMFixture,
  crossChainHyperEVMFixture,
};
