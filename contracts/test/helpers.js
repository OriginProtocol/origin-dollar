const bre = require("@nomiclabs/buidler");
const chai = require("chai");
const { parseUnits } = require("ethers").utils;
const BigNumber = require("ethers").BigNumber;
const { createFixtureLoader } = require("ethereum-waffle");

const addresses = require("../utils/addresses");

chai.Assertion.addMethod("approxEqual", function (expected, message) {
  const actual = this._obj;
  chai.expect(actual, message).gte(expected.mul("9999").div("10000"));
  chai.expect(actual, message).lte(expected.mul("10001").div("10000"));
});

chai.Assertion.addMethod("approxBalanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  var address = user.address || user.getAddress(); // supports contracts too
  const actual = await contract.balanceOf(address);
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.approxEqual(expected, message);
});

chai.Assertion.addMethod("balanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  var address = user.address || user.getAddress(); // supports contracts too
  const actual = await contract.balanceOf(address);
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.equal(expected, message);
});

const DECIMAL_CACHE = {};
async function decimalsFor(contract) {
  if (DECIMAL_CACHE[contract.address] != undefined) {
    return DECIMAL_CACHE[contract.address];
  }
  let decimals = await contract.decimals();
  if (decimals.toNumber) {
    decimals = decimals.toNumber();
  }
  DECIMAL_CACHE[contract.address] = decimals;
  return decimals;
}

async function units(amount, contract) {
  return parseUnits(amount, await decimalsFor(contract));
}

function ousdUnits(amount) {
  return parseUnits(amount, 18);
}

function usdtUnits(amount) {
  return parseUnits(amount, 6);
}

function usdcUnits(amount) {
  return parseUnits(amount, 6);
}

function tusdUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnits(amount) {
  return parseUnits(amount, 18);
}

function ethUnits(amount) {
  return parseUnits(amount, 18);
}

function oracleUnits(amount) {
  return parseUnits(amount, 6);
}

async function expectApproxSupply(contract, expected, message) {
  const balance = await contract.totalSupply();
  chai.expect(balance, message).gt(expected.mul("999").div("1000"));
  chai.expect(balance, message).lt(expected.mul("1001").div("1000"));
}

async function humanBalance(user, contract) {
  let address = user.address || user.getAddress(); // supports contracts too
  const balance = await contract.balanceOf(address);
  const decimals = await decimalsFor(contract);
  const divisor = BigNumber.from("10").pow(decimals);
  return parseFloat(balance.div(divisor).toString()).toFixed(2);
}

const isGanacheFork = bre.network.name === "fork";

// The coverage network soliditycoverage uses Ganache
const isGanache =
  isGanacheFork ||
  bre.network.name === "soliditycoverage" ||
  bre.network.name === "ganache";

const isRinkeby = bre.network.name === "rinkeby";
const isMainnet = bre.network.name === "mainnet";

const isMainnetOrFork = isMainnet || isGanacheFork;
const isMainnetOrRinkebyOrFork = isMainnet || isRinkeby || isGanacheFork;

// Fixture loader that is compatible with Ganache
const loadFixture = createFixtureLoader(
  [
    bre.ethers.provider.getSigner(0),
    bre.ethers.provider.getSigner(1),
    bre.ethers.provider.getSigner(2),
    bre.ethers.provider.getSigner(3),
    bre.ethers.provider.getSigner(4),
    bre.ethers.provider.getSigner(5),
    bre.ethers.provider.getSigner(6),
    bre.ethers.provider.getSigner(7),
    bre.ethers.provider.getSigner(8),
    bre.ethers.provider.getSigner(9),
  ],
  bre.ethers.provider
);

const advanceTime = async (seconds) => {
  await bre.ethers.provider.send("evm_increaseTime", [seconds]);
  await bre.ethers.provider.send("evm_mine");
};

const getOracleAddress = async (deployments) => {
  return (await deployments.get("MixOracle")).address;
};

/**
 * Sets the price in ETH the mix oracle will return for a specific token.
 * @param {string} tokenSymbol: "DAI", USDC", etc...
 * @param {number} ethPrice: price of the token in ETH.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceEth = async (tokenSymbol, ethPrice) => {
  if (isMainnetOrFork) {
    throw new Error(
      `setOracleTokenPriceEth not supported on network ${bre.network.name}`
    );
  }

  const feedName = "MockChainlinkOracleFeed" + tokenSymbol;
  const feed = await ethers.getContract(feedName);
  await feed.setDecimals(18);
  await feed.setPrice(parseUnits(ethPrice), 18);

  // TODO: Set price on the Uniswap oracle once it gets added to mixOracle.
};

/**
 * Sets the price in USD the mix oracle will return for a specific token.
 * This first sets the ETH price in USD, then token price in ETH
 *
 * @param {string} tokenSymbol: "DAI", USDC", etc...
 * @param {number} usdPrice: price of the token in USD.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceUsd = async (tokenSymbol, usdPrice) => {
  if (isMainnetOrFork) {
    throw new Error(
      `setOracleTokenPriceUsd not supported on network ${bre.network.name}`
    );
  }

  const ethPriceUsd = "100"; // Arbitrarily choose exchange rate: 1 ETH = $100.

  // Set the ETH price to 100 USD, with 8 decimals.
  const ethFeed = await ethers.getContract("MockChainlinkOracleFeedETH");
  await ethFeed.setDecimals(8);
  await ethFeed.setPrice(parseUnits(ethPriceUsd, 8));

  // Set the token price in ETH, with 18 decimals.
  const tokenPriceEth = (usdPrice / ethPriceUsd).toString();
  const tokenFeed = await ethers.getContract(
    "MockChainlinkOracleFeed" + tokenSymbol
  );
  await tokenFeed.setDecimals(18);
  await tokenFeed.setPrice(parseUnits(tokenPriceEth, 18));

  // Set the price on the Open Price Feed Oracle
  const openOracle = await ethers.getContract("MockOracle");
  openOracle.setPrice(tokenSymbol, parseUnits(usdPrice, 6));

  // TODO: Set price on the Uniswap oracle once it gets added to mixOracle.
};

const setOracleTokenPriceUsdMinMax = async (
  tokenSymbol,
  usdPriceMin,
  usdPriceMax
) => {
  if (isMainnetOrFork) {
    throw new Error(
      `setOracleTokenPriceUsd not supported on network ${bre.network.name}`
    );
  }

  const ethPriceUsd = "100"; // Arbitrarily choose exchange rate: 1 ETH = $100.

  // Set the ETH price to 100 USD, with 8 decimals.
  const ethFeed = await ethers.getContract("MockChainlinkOracleFeedETH");
  await ethFeed.setDecimals(8);
  await ethFeed.setPrice(parseUnits(ethPriceUsd, 8));

  // Set the token price in ETH, with 18 decimals.
  const tokenPriceEth = (usdPriceMin / ethPriceUsd).toString();
  const tokenFeed = await ethers.getContract(
    "MockChainlinkOracleFeed" + tokenSymbol
  );
  await tokenFeed.setDecimals(18);
  await tokenFeed.setPrice(parseUnits(tokenPriceEth, 18));

  // Set the price on the Open Price Feed Oracle
  const openOracle = await ethers.getContract("MockOracle");
  openOracle.setPrice(tokenSymbol, parseUnits(usdPriceMax, 6));
};

const getOracleAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    // On mainnet or fork, return mainnet addresses.
    return {
      chainlink: {
        ETH_USD: addresses.mainnet.chainlinkETH_USD,
        DAI_ETH: addresses.mainnet.chainlinkDAI_ETH,
        USDC_ETH: addresses.mainnet.chainlinkUSDC_ETH,
        USDT_ETH: addresses.mainnet.chainlinkUSDT_ETH,
      },
      uniswap: {
        DAI_ETH: addresses.mainnet.uniswapDAI_ETH,
        USDC_ETH: addresses.mainnet.uniswapUSDC_ETH,
        USDT_ETH: addresses.mainnet.uniswapUSDT_ETH,
      },
      openOracle: addresses.mainnet.openOracle,
    };
  } else {
    // On other environments, return mock feeds.
    return {
      chainlink: {
        ETH_USD: (await deployments.get("MockChainlinkOracleFeedETH")).address,
        DAI_ETH: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
        USDC_ETH: (await deployments.get("MockChainlinkOracleFeedUSDC"))
          .address,
        USDT_ETH: (await deployments.get("MockChainlinkOracleFeedUSDT"))
          .address,
        TUSD_ETH: (await deployments.get("MockChainlinkOracleFeedTUSD"))
          .address,
        NonStandardToken_ETH: (
          await deployments.get("MockChainlinkOracleFeedNonStandardToken")
        ).address,
      },
      uniswap: {
        DAI_ETH: (await deployments.get("MockUniswapPairDAI_ETH")).address,
        USDC_ETH: (await deployments.get("MockUniswapPairUSDC_ETH")).address,
        USDT_ETH: (await deployments.get("MockUniswapPairUSDT_ETH")).address,
      },
      openOracle: (await deployments.get("MockOracle")).address,
    };
  }
};

const getAssetAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    return {
      USDT: addresses.mainnet.USDT,
      USDC: addresses.mainnet.USDC,
      TUSD: addresses.mainnet.TUSD,
      DAI: addresses.mainnet.DAI,
      cDAI: addresses.mainnet.cDAI,
      cUSDC: addresses.mainnet.cUSDC,
      cUSDT: addresses.mainnet.cUSDT,
      WETH: addresses.mainnet.WETH,
      COMP: addresses.mainnet.COMP,
      ThreePool: addresses.mainnet.ThreePool,
      ThreePoolToken: addresses.mainnet.ThreePoolToken,
      ThreePoolGauge: addresses.mainnet.ThreePoolGauge,
      CRV: addresses.mainnet.CRV,
      CRVMinter: addresses.mainnet.CRVMinter,
    };
  } else {
    return {
      USDT: (await deployments.get("MockUSDT")).address,
      USDC: (await deployments.get("MockUSDC")).address,
      TUSD: (await deployments.get("MockTUSD")).address,
      DAI: (await deployments.get("MockDAI")).address,
      cDAI: (await deployments.get("MockCDAI")).address,
      cUSDC: (await deployments.get("MockCUSDC")).address,
      cUSDT: (await deployments.get("MockCUSDT")).address,
      NonStandardToken: (await deployments.get("MockNonStandardToken")).address,
      WETH: (await deployments.get("MockWETH")).address,
      COMP: (await deployments.get("MockCOMP")).address,
      ThreePool: (await deployments.get("MockCurvePool")).address,
      ThreePoolToken: (await deployments.get("Mock3CRV")).address,
      ThreePoolGauge: (await deployments.get("MockCurveGauge")).address,
      CRV: (await deployments.get("MockCRV")).address,
      CRVMinter: (await deployments.get("MockCRVMinter")).address,
    };
  }
};

async function governorArgs({ contract, value = 0, signature, args = [] }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, value, signature, data];
}

async function proposeArgs(governorArgsArray) {
  const targets = [],
    values = [],
    sigs = [],
    datas = [];
  for (const g of governorArgsArray) {
    const [t, v, s, d] = await governorArgs(g);
    targets.push(t);
    values.push(v);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, values, sigs, datas];
}

module.exports = {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  tusdUnits,
  daiUnits,
  ethUnits,
  oracleUnits,
  units,
  humanBalance,
  expectApproxSupply,
  advanceTime,
  isMainnet,
  isRinkeby,
  isGanache,
  isGanacheFork,
  isMainnetOrFork,
  isMainnetOrRinkebyOrFork,
  loadFixture,
  getOracleAddress,
  setOracleTokenPriceEth,
  setOracleTokenPriceUsd,
  setOracleTokenPriceUsdMinMax,
  getOracleAddresses,
  getAssetAddresses,
  governorArgs,
  proposeArgs,
};
