const hre = require("hardhat");
const { BigNumber } = require("ethers");
const { parseUnits, formatUnits } = require("ethers").utils;

const addresses = require("./addresses");
const { decimalsFor, units } = require("./units");

function ognUnits(amount) {
  return parseUnits(amount, 18);
}

function ousdUnits(amount) {
  return parseUnits(amount, 18);
}

function oethUnits(amount) {
  return parseUnits(amount, 18);
}

function frxETHUnits(amount) {
  return parseUnits(amount, 18);
}

function fraxUnits(amount) {
  return parseUnits(amount, 18);
}

function ousdUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function usdtUnits(amount) {
  return parseUnits(amount, 6);
}

function usdtUnitsFormat(amount) {
  return formatUnits(amount, 6);
}

function usdcUnits(amount) {
  return parseUnits(amount, 6);
}

function usdcUnitsFormat(amount) {
  return formatUnits(amount, 6);
}

function usdsUnits(amount) {
  return parseUnits(amount, 18);
}

function usdsUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function ethUnits(amount) {
  return parseUnits(amount, 18);
}

function oracleUnits(amount) {
  return parseUnits(amount, 6);
}

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMainnet = hre.network.name === "mainnet";
const isExternalNet = isMainnet;
const isTest = process.env.IS_TEST === "true";
const isSmokeTest = process.env.SMOKE_TEST === "true";
const isMainnetOrFork =
  isMainnet || (isFork && hre.network.config.chainId == 1);
const isForkTest = isFork && isTest;
const isMainnetForkTest = isForkTest && hre.network.config.chainId == 1;
const isForkWithLocalNode = isFork && process.env.LOCAL_PROVIDER_URL;
const isArbitrumOne = hre.network.name == "arbitrumOne";
const isArbFork = isFork && process.env.FORK_NETWORK_NAME == "arbitrumOne";
const isArbitrumOneOrFork = isArbitrumOne || isArbFork;
const isCI = process.env.GITHUB_ACTIONS;
const isBase = hre.network.name == "base";
const isBaseFork = isFork && process.env.FORK_NETWORK_NAME == "base";
const isBaseOrFork = isBase || isBaseFork;
const isBaseUnitTest = process.env.UNIT_TESTS_NETWORK === "base";
const isSonic = hre.network.name == "sonic";
const isSonicFork = isFork && process.env.FORK_NETWORK_NAME == "sonic";
const isSonicOrFork = isSonic || isSonicFork;
const isSonicUnitTest = process.env.UNIT_TESTS_NETWORK === "sonic";
const isPlume = hre.network.name == "plume";
const isPlumeFork = isFork && process.env.FORK_NETWORK_NAME == "plume";
const isPlumeOrFork = isPlume || isPlumeFork;
const isPlumeUnitTest = process.env.UNIT_TESTS_NETWORK === "plume";
const isHoodi = hre.network.name == "hoodi";
const isHoodiFork = isFork && process.env.FORK_NETWORK_NAME == "hoodi";
const isHoodiOrFork = isHoodi || isHoodiFork;
const isHyperEVM = hre.network.name == "hyperevm";
const isHyperEVMFork = isFork && process.env.FORK_NETWORK_NAME == "hyperevm";
const isHyperEVMOrFork = isHyperEVM || isHyperEVMFork;
const isHyperEVMUnitTest = process.env.UNIT_TESTS_NETWORK === "hyperevm";

const advanceTime = async (seconds) => {
  seconds = Math.floor(seconds);
  await hre.ethers.provider.send("evm_increaseTime", [seconds]);
  await hre.ethers.provider.send("evm_mine");
};

const getBlockTimestamp = async () => {
  return (await hre.ethers.provider.getBlock("latest")).timestamp;
};

const advanceBlocks = async (numBlocks) => {
  let blocksHex = BigNumber.from(numBlocks).toHexString();
  blocksHex = blocksHex.replace(/^0x0+/, "0x");
  await hre.network.provider.send("hardhat_mine", [blocksHex]);
};

const getAssetAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    return {
      USDT: addresses.mainnet.USDT,
      USDC: addresses.mainnet.USDC,
      DAI: addresses.mainnet.DAI,
      USDS: addresses.mainnet.USDS,
      WETH: addresses.mainnet.WETH,
      OGN: addresses.mainnet.OGN,
      uniswapRouter: addresses.mainnet.uniswapRouter,
      uniswapV3Router: addresses.mainnet.uniswapV3Router,
      uniswapUniversalRouter: addresses.mainnet.uniswapUniversalRouter,
      sushiswapRouter: addresses.mainnet.sushiswapRouter,
      beaconChainDepositContract: addresses.mainnet.beaconChainDepositContract,
    };
  }

  if (isHoodiOrFork) {
    return {
      WETH: addresses.hoodi.WETH,
      beaconChainDepositContract: addresses.hoodi.beaconChainDepositContract,
    };
  }

  return {
    USDT: (await deployments.get("MockUSDT")).address,
    USDC: (await deployments.get("MockUSDC")).address,
    USDS: (await deployments.get("MockUSDS")).address,
    NonStandardToken: (await deployments.get("MockNonStandardToken")).address,
    WETH: addresses.mainnet.WETH,
    OGN: (await deployments.get("MockOGN")).address,
    uniswapRouter: (await deployments.get("MockUniswapRouter")).address,
    uniswapV3Router: (await deployments.get("MockUniswapRouter")).address,
    uniswapUniversalRouter: (await deployments.get("MockUniswapRouter"))
      .address,
    sushiswapRouter: (await deployments.get("MockUniswapRouter")).address,
    beaconChainDepositContract: (await deployments.get("MockDepositContract"))
      .address,
  };
};

async function governorArgs({ contract, signature, args = [] }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, signature, data];
}

async function proposeArgs(governorArgsArray) {
  const targets = [];
  const sigs = [];
  const datas = [];

  for (const args of governorArgsArray) {
    const [target, signature, data] = await governorArgs(args);
    targets.push(target);
    sigs.push(signature);
    datas.push(data);
  }

  return [targets, sigs, datas];
}

module.exports = {
  decimalsFor,
  ousdUnits,
  oethUnits,
  usdtUnits,
  usdcUnits,
  usdsUnits,
  ognUnits,
  ethUnits,
  fraxUnits,
  oracleUnits,
  frxETHUnits,
  units,
  ousdUnitsFormat,
  usdcUnitsFormat,
  usdtUnitsFormat,
  usdsUnitsFormat,
  advanceTime,
  getBlockTimestamp,
  isMainnet,
  isExternalNet,
  isFork,
  isTest,
  isSmokeTest,
  isLocalhost,
  isMainnetOrFork,
  isMainnetForkTest,
  isForkTest,
  isForkWithLocalNode,
  isArbitrumOne,
  isArbitrumOneOrFork,
  isArbFork,
  isCI,
  isBase,
  isBaseFork,
  isBaseOrFork,
  isBaseUnitTest,
  isSonic,
  isSonicFork,
  isSonicOrFork,
  isSonicUnitTest,
  isPlume,
  isPlumeFork,
  isPlumeOrFork,
  isPlumeUnitTest,
  isHoodi,
  isHoodiFork,
  isHoodiOrFork,
  isHyperEVM,
  isHyperEVMFork,
  isHyperEVMOrFork,
  isHyperEVMUnitTest,
  getAssetAddresses,
  governorArgs,
  proposeArgs,
  advanceBlocks,
};
