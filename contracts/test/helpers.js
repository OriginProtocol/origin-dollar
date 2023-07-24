const hre = require("hardhat");
const chai = require("chai");
const mocha = require("mocha");
const { parseUnits, formatUnits, parseEther } = require("ethers").utils;
const BigNumber = require("ethers").BigNumber;
const { createFixtureLoader } = require("ethereum-waffle");

const addresses = require("../utils/addresses");

/**
 * Checks if the actual value is approximately equal to the expected value
 * within 0.99999 to 1.00001 tolerance.
 */
chai.Assertion.addMethod("approxEqual", function (expected, message) {
  const actual = this._obj;
  chai.expect(actual, message).gte(expected.mul("99999").div("100000"));
  chai.expect(actual, message).lte(expected.mul("100001").div("100000"));
});

/**
 * Checks if the actual value is approximately equal to the expected value
 * within a specified percentage tolerance.
 * @param {number} [maxTolerancePct=1] - The maximum percentage tolerance allowed for the comparison (default is 1%).
 * @examples
 *   expect(1010).to.approxEqualTolerance(1000, 1); // true
 *   expect(1011).to.approxEqualTolerance(1000, 1); // false
 *   expect(1000).to.approxEqualTolerance(1011, 1); // true
 *   expect(1000).to.approxEqualTolerance(1012, 1); // false
 *   expect(1001).to.approxEqualTolerance(1000, 0.1); // true
 */
chai.Assertion.addMethod(
  "approxEqualTolerance",
  function (expected, maxTolerancePct = 1, message = undefined) {
    const actual = this._obj;
    expected = BigNumber.from(expected);
    if (expected.gte(BigNumber.from(0))) {
      chai
        .expect(actual, message)
        .gte(expected.mul(10000 - maxTolerancePct * 100).div(10000));
      chai
        .expect(actual, message)
        .lte(expected.mul(10000 + maxTolerancePct * 100).div(10000));
    } else {
      chai
        .expect(actual, message)
        .gte(expected.mul(10000 + maxTolerancePct * 100).div(10000));
      chai
        .expect(actual, message)
        .lte(expected.mul(10000 - maxTolerancePct * 100).div(10000));
    }
  }
);

chai.Assertion.addMethod(
  "approxBalanceOf",
  async function (expected, contract, message) {
    const user = this._obj;
    const address = user.address || user.getAddress(); // supports contracts too
    const actual = await contract.balanceOf(address);
    if (!BigNumber.isBigNumber(expected)) {
      expected = parseUnits(expected, await decimalsFor(contract));
    }
    chai.expect(actual).to.approxEqual(expected, message);
  }
);

/**
 * Checks if the actual balance of the user or contract address is equal to
 * the expected value, converted to the appropriate unit of account.
 *
 * @param {Contract} contract - The token contract to check the balance of.
 */
chai.Assertion.addMethod(
  "balanceOf",
  async function (expected, contract, message) {
    const user = this._obj;
    const address = user.address || user.getAddress(); // supports contracts too
    const actual = await contract.balanceOf(address);
    if (!BigNumber.isBigNumber(expected)) {
      expected = parseUnits(expected, await decimalsFor(contract));
    }
    chai.expect(actual).to.equal(expected, message);
  }
);

chai.Assertion.addMethod(
  "approxBalanceWithToleranceOf",
  async function (expected, contract, tolerancePct = 1, message = undefined) {
    const user = this._obj;
    const address = user.address || user.getAddress(); // supports contracts too
    const actual = await contract.balanceOf(address);
    if (!BigNumber.isBigNumber(expected)) {
      expected = parseUnits(expected, await decimalsFor(contract));
    }
    chai
      .expect(actual)
      .to.approxEqualTolerance(expected, tolerancePct, message);
  }
);

chai.Assertion.addMethod("totalSupplyOf", async function (expected, message) {
  const contract = this._obj;
  const actual = await contract.totalSupply();
  if (!BigNumber.isBigNumber(expected)) {
    expected = parseUnits(expected, await decimalsFor(contract));
  }
  chai.expect(actual).to.equal(expected, message);
});

chai.Assertion.addMethod(
  "approxTotalSupplyOf",
  async function (expected, message) {
    const contract = this._obj;
    const actual = await contract.totalSupply();
    if (!BigNumber.isBigNumber(expected)) {
      expected = parseUnits(expected, await decimalsFor(contract));
    }
    chai.expect(actual).to.approxEqualTolerance(expected, 1, message);
  }
);

chai.Assertion.addMethod(
  "assetBalanceOf",
  async function (expected, asset, message) {
    const strategy = this._obj;
    const assetAddress = asset.address || asset.getAddress();
    const actual = await strategy.checkBalance(assetAddress);
    if (!BigNumber.isBigNumber(expected)) {
      expected = parseUnits(expected, await decimalsFor(asset));
    }
    chai.expect(actual).to.approxEqualTolerance(expected, 1, message);
  }
);

chai.Assertion.addMethod("emittedEvent", async function (eventName, args) {
  const tx = this._obj;
  const { events } = await tx.wait();
  const log = events.find((e) => e.event == eventName);
  chai.expect(log).to.not.be.undefined;

  if (Array.isArray(args)) {
    chai
      .expect(log.args.length)
      .to.equal(args.length, "Invalid event arg count");
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "function") {
        args[i](log.args[i]);
      } else {
        chai.expect(log.args[i]).to.equal(args[i]);
      }
    }
  }
});

/**
 * Returns the number of decimal places used by the given token contract.
 * Uses a cache to avoid making unnecessary contract calls for the same contract address.
 * @param {Contract} contract - The token contract to get the decimal places for.
 */
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

/**
 * Converts an amount in the base unit of a contract to the standard decimal unit for the contract.
 * @param {string} amount - The amount to convert, represented as a string in the base unit of the contract.
 * @param {Contract} contract - The token contract to get the decimal places for.
 */
async function units(amount, contract) {
  return parseUnits(amount, await decimalsFor(contract));
}

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

/**
 * Converts an amount in wei to a 18 decimal places string.
 * @param {BigNumberish} amount - The amount to convert, in wei
 */
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

function tusdUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function ethUnits(amount) {
  return parseUnits(amount, 18);
}

function oracleUnits(amount) {
  return parseUnits(amount, 6);
}

function cDaiUnits(amount) {
  return parseUnits(amount, 8);
}

function cUsdcUnits(amount) {
  return parseUnits(amount, 8);
}

/**
 * Asserts that the total supply of a contract is approximately equal to an expected value, with a tolerance of 0.1%.
 * @param {Contract} contract - The token contract to check the total supply of.
 * @param {BigNumber|string} expected - The expected total supply, represented as a BigNumber or a string.
 */
async function expectApproxSupply(contract, expected, message) {
  const balance = await contract.totalSupply();
  // shortcuts the 0 case, since that's neither gt or lt
  if (balance.eq(expected)) {
    return;
  }
  chai.expect(balance, message).gt(expected.mul("999").div("1000"));
  chai.expect(balance, message).lt(expected.mul("1001").div("1000"));
}

/**
 * Retrieves the user's or contract's token balance formatted as a string with 2 decimal places
 * @param {ethers.Signer | ethers.Contract} user - The user or contract whose balance to retrieve
 * @param {ethers.Contract} contract - The contract to retrieve the balance from
 */
async function humanBalance(user, contract) {
  let address = user.address || user.getAddress(); // supports contracts too
  const balance = await contract.balanceOf(address);
  const decimals = await decimalsFor(contract);
  const divisor = BigNumber.from("10").pow(decimals);
  return parseFloat(balance.div(divisor).toString()).toFixed(2);
}

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMainnet = hre.network.name === "mainnet";
const isTest = process.env.IS_TEST === "true";
const isSmokeTest = process.env.SMOKE_TEST === "true";
const isMainnetOrFork = isMainnet || isFork;
const isForkTest = isFork && isTest;
const isForkWithLocalNode = isFork && process.env.LOCAL_PROVIDER_URL;

// Fixture loader that is compatible with Ganache
const loadFixture = createFixtureLoader(
  [
    hre.ethers.provider.getSigner(0),
    hre.ethers.provider.getSigner(1),
    hre.ethers.provider.getSigner(2),
    hre.ethers.provider.getSigner(3),
    hre.ethers.provider.getSigner(4),
    hre.ethers.provider.getSigner(5),
    hre.ethers.provider.getSigner(6),
    hre.ethers.provider.getSigner(7),
    hre.ethers.provider.getSigner(8),
    hre.ethers.provider.getSigner(9),
  ],
  hre.ethers.provider
);

/// Advances the EVM time by the given number of seconds
const advanceTime = async (seconds) => {
  seconds = Math.floor(seconds);
  await hre.ethers.provider.send("evm_increaseTime", [seconds]);
  await hre.ethers.provider.send("evm_mine");
};

/// Gets the timestamp of the latest block
const getBlockTimestamp = async () => {
  return (await hre.ethers.provider.getBlock("latest")).timestamp;
};

/// Advances the blockchain forward by the specified number of blocks
const advanceBlocks = async (numBlocks) => {
  for (let i = 0; i < numBlocks; i++) {
    await hre.ethers.provider.send("evm_mine");
  }
};

const getOracleAddress = async (deployments) => {
  return (await deployments.get("OracleRouter")).address;
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
  const symbolMap = {
    USDC: 6,
    USDT: 6,
    DAI: 6,
    COMP: 6,
    CVX: 6,
    CRV: 6,
  };

  if (isMainnetOrFork) {
    throw new Error(
      `setOracleTokenPriceUsd not supported on network ${hre.network.name}`
    );
  }
  // Set the chainlink token price in USD, with 8 decimals.
  const tokenFeed = await ethers.getContract(
    "MockChainlinkOracleFeed" + tokenSymbol
  );

  const decimals = Object.keys(symbolMap).includes(tokenSymbol)
    ? symbolMap[tokenSymbol]
    : 18;
  await tokenFeed.setDecimals(decimals);
  await tokenFeed.setPrice(parseUnits(usdPrice, decimals));
};

const getOracleAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    // On mainnet or fork, return mainnet addresses.
    return {
      chainlink: {
        ETH_USD: addresses.mainnet.chainlinkETH_USD,
        DAI_USD: addresses.mainnet.chainlinkDAI_USD,
        USDC_USD: addresses.mainnet.chainlinkUSDC_USD,
        USDT_USD: addresses.mainnet.chainlinkUSDT_USD,
        COMP_USD: addresses.mainnet.chainlinkCOMP_USD,
        AAVE_USD: addresses.mainnet.chainlinkAAVE_USD,
        CRV_USD: addresses.mainnet.chainlinkCRV_USD,
        CVX_USD: addresses.mainnet.chainlinkCVX_USD,
        OGN_ETH: addresses.mainnet.chainlinkOGN_ETH,
        RETH_ETH: addresses.mainnet.chainlinkRETH_ETH,
        stETH_ETH: addresses.mainnet.chainlinkstETH_ETH,
      },
      openOracle: addresses.mainnet.openOracle, // Deprecated
    };
  } else {
    // On other environments, return mock feeds.
    return {
      chainlink: {
        ETH_USD: (await deployments.get("MockChainlinkOracleFeedETH")).address,
        DAI_USD: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
        USDC_USD: (await deployments.get("MockChainlinkOracleFeedUSDC"))
          .address,
        USDT_USD: (await deployments.get("MockChainlinkOracleFeedUSDT"))
          .address,
        TUSD_USD: (await deployments.get("MockChainlinkOracleFeedTUSD"))
          .address,
        COMP_USD: (await deployments.get("MockChainlinkOracleFeedCOMP"))
          .address,
        AAVE_USD: (await deployments.get("MockChainlinkOracleFeedAAVE"))
          .address,
        CRV_USD: (await deployments.get("MockChainlinkOracleFeedCRV")).address,
        CVX_USD: (await deployments.get("MockChainlinkOracleFeedCVX")).address,
        OGN_ETH: (await deployments.get("MockChainlinkOracleFeedOGNETH"))
          .address,
        RETH_ETH: (await deployments.get("MockChainlinkOracleFeedRETHETH"))
          .address,
        STETH_ETH: (await deployments.get("MockChainlinkOracleFeedstETHETH"))
          .address,
        FRXETH_ETH: (await deployments.get("MockChainlinkOracleFeedfrxETHETH"))
          .address,
        WETH_ETH: (await deployments.get("MockChainlinkOracleFeedWETHETH"))
          .address,
        NonStandardToken_USD: (
          await deployments.get("MockChainlinkOracleFeedNonStandardToken")
        ).address,
      },
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
      CVX: addresses.mainnet.CVX,
      CRVMinter: addresses.mainnet.CRVMinter,
      aDAI: addresses.mainnet.aDAI,
      aDAI_v2: addresses.mainnet.aDAI_v2,
      aUSDC: addresses.mainnet.aUSDC,
      aUSDT: addresses.mainnet.aUSDT,
      aWETH: addresses.mainnet.aWETH,
      AAVE: addresses.mainnet.Aave,
      AAVE_TOKEN: addresses.mainnet.Aave,
      AAVE_ADDRESS_PROVIDER: addresses.mainnet.AAVE_ADDRESS_PROVIDER,
      AAVE_INCENTIVES_CONTROLLER: addresses.mainnet.AAVE_INCENTIVES_CONTROLLER,
      STKAAVE: addresses.mainnet.STKAAVE,
      OGN: addresses.mainnet.OGN,
      OGV: addresses.mainnet.OGV,
      RewardsSource: addresses.mainnet.RewardsSource,
      RETH: addresses.mainnet.rETH,
      frxETH: addresses.mainnet.frxETH,
      stETH: addresses.mainnet.stETH,
      sfrxETH: addresses.mainnet.sfrxETH,
      uniswapRouter: addresses.mainnet.uniswapRouter,
      uniswapV3Router: addresses.mainnet.uniswapV3Router,
      sushiswapRouter: addresses.mainnet.sushiswapRouter,
    };
  } else {
    const addressMap = {
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
      CVX: (await deployments.get("MockCVX")).address,
      CRVMinter: (await deployments.get("MockCRVMinter")).address,
      aDAI: (await deployments.get("MockADAI")).address,
      aUSDC: (await deployments.get("MockAUSDC")).address,
      aUSDT: (await deployments.get("MockAUSDT")).address,
      AAVE: (await deployments.get("MockAave")).address,
      AAVE_TOKEN: (await deployments.get("MockAAVEToken")).address,
      AAVE_ADDRESS_PROVIDER: (await deployments.get("MockAave")).address,
      STKAAVE: (await deployments.get("MockStkAave")).address,
      OGN: (await deployments.get("MockOGN")).address,
      OGV: (await deployments.get("MockOGV")).address,
      RETH: (await deployments.get("MockRETH")).address,
      stETH: (await deployments.get("MockstETH")).address,
      frxETH: (await deployments.get("MockfrxETH")).address,
      sfrxETH: (await deployments.get("MocksfrxETH")).address,
      // Note: This is only used to transfer the swapped OGV in `Buyback` contract.
      // So, as long as this is a valid address, it should be fine.
      RewardsSource: addresses.dead,
      uniswapRouter: (await deployments.get("MockUniswapRouter")).address,
      uniswapV3Router: (await deployments.get("MockUniswapRouter")).address,
      sushiswapRouter: (await deployments.get("MockUniswapRouter")).address,
    };

    try {
      /* Metapool gets deployed in 001_core instead of 000_mocks and is requested even when
       * metapool is not yet deployed. Just return without metapool info if it is not
       * yet available.
       */
      addressMap.ThreePoolOUSDMetapool = (
        await deployments.get("MockCurveMetapool")
      ).address;
      // token is implemented by the same contract as the metapool
      addressMap.metapoolToken = (
        await deployments.get("MockCurveMetapool")
      ).address;
    } catch (e) {
      // do nothing
    }

    try {
      /* Metapool gets deployed in 001_core instead of 000_mocks and is requested even when
       * metapool is not yet deployed. Just return without metapool info if it is not
       * yet available.
       */
      addressMap.ThreePoolLUSDMetapool = (
        await deployments.get("MockCurveLUSDMetapool")
      ).address;
      // token is implemented by the same contract as the metapool
      addressMap.LUSDMetapoolToken = (
        await deployments.get("MockCurveLUSDMetapool")
      ).address;
    } catch (e) {
      // do nothing
    }

    return addressMap;
  }
};

async function fundAccount(address, balance = "1000") {
  await hre.network.provider.send("hardhat_setBalance", [
    address,
    parseEther(balance).toHexString(),
  ]);
}

/**
 * Calculates the change in balance after a function has been executed on a contract
 * @param {Function} functionChangingBalance - The function that changes the balance
 * @param {Object} balanceChangeContract - The token contract
 * @param {string} balanceChangeAccount - The account for which the balance is being changed
 **/
async function changeInBalance(
  functionChangingBalance,
  balanceChangeContract,
  balanceChangeAccount
) {
  const balanceBefore = await balanceChangeContract.balanceOf(
    balanceChangeAccount
  );
  await functionChangingBalance();
  const balanceAfter = await balanceChangeContract.balanceOf(
    balanceChangeAccount
  );
  return balanceAfter - balanceBefore;
}

/**
 * Is first parameter's BigNumber value inside expected tolerance
 * @param {BigNumber} bigNumber: The BigNumber whose value is being inspected
 * @param {BigNumber} bigNumberExpected: Expected value of the first BigNumber
 * @param {Float} tolerance: Tolerance expressed in percentages. E.g. 0.05 equals 5%
 *
 * @returns {boolean}
 */
function isWithinTolerance(bigNumber, bigNumberExpected, tolerance) {
  const bgTolerance = bigNumberExpected
    .mul(tolerance * 1000)
    .div(BigNumber.from(1000));
  const lowestAllowed = bigNumberExpected.sub(bgTolerance);
  const highestAllowed = bigNumberExpected.add(bgTolerance);

  return bigNumber.gte(lowestAllowed) && bigNumber.lte(highestAllowed);
}

/**
 * Return the difference in ERC20 `token` balance of an `address` after
 * the `asyncFn` is executed.
 */
async function differenceInErc20TokenBalance(address, tokenContract, asyncFn) {
  const balanceBefore = await tokenContract.balanceOf(address);
  await asyncFn();
  return (await tokenContract.balanceOf(address)).sub(balanceBefore);
}

/**
 * Return the difference in ERC20 `token` balance of an `address` after
 * the `asyncFn` is executed. Takes array as an input and also returns array
 * of values
 */
async function differenceInErc20TokenBalances(
  addresses,
  tokenContracts,
  asyncFn
) {
  if (addresses.length !== tokenContracts.length) {
    throw new Error(
      "addresses and tokenContracts arrays need to be of same length"
    );
  }

  const arrayLength = addresses.length;
  const balancesBefore = Array(arrayLength);
  const returnVals = Array(arrayLength);

  for (let i = 0; i < arrayLength; i++) {
    balancesBefore[i] = await tokenContracts[i].balanceOf(addresses[i]);
  }
  await asyncFn();

  for (let i = 0; i < arrayLength; i++) {
    returnVals[i] = (await tokenContracts[i].balanceOf(addresses[i])).sub(
      balancesBefore[i]
    );
  }

  return returnVals;
}

/**
 * Return the difference strategy balance `strategyContract` for the `assetAddress` asset
 * after the `asyncFn` is executed.
 *
 * assetAddresses & strategyContracts can either be an array or a single address. Return type
 * depends on input parameters, can also either be an array or single value
 */
async function differenceInStrategyBalance(
  assetAddresses,
  strategyContracts,
  asyncFn
) {
  let inputArray = false;
  if (Array.isArray(assetAddresses) || Array.isArray(strategyContracts)) {
    inputArray = true;
  } else {
    // turn into an array for more uniform implementation
    assetAddresses = [assetAddresses];
    strategyContracts = [strategyContracts];
  }

  if (assetAddresses.length !== strategyContracts.length) {
    throw new Error(
      "assetAddresses and strategyContracts arrays need to be of same length"
    );
  }

  const arrayLength = assetAddresses.length;
  const balancesBefore = Array(arrayLength);
  const returnVals = Array(arrayLength);

  for (let i = 0; i < arrayLength; i++) {
    balancesBefore[i] = await strategyContracts[i].checkBalance(
      assetAddresses[i]
    );
  }
  await asyncFn();

  for (let i = 0; i < arrayLength; i++) {
    returnVals[i] = (
      await strategyContracts[i].checkBalance(assetAddresses[i])
    ).sub(balancesBefore[i]);
  }

  // if input params weren't arrays return a single value
  if (!inputArray) {
    return returnVals[0];
  }

  return returnVals;
}

async function governorArgs({ contract, signature, args = [] }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, signature, data];
}

async function proposeArgs(governorArgsArray) {
  const targets = [],
    sigs = [],
    datas = [];
  for (const g of governorArgsArray) {
    const [t, s, d] = await governorArgs(g);
    targets.push(t);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, sigs, datas];
}

async function propose(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const lastProposalId = await governorContract.proposalCount();
  await governorContract
    .connect(governor)
    .propose(...(await proposeArgs(governorArgsArray)), description);
  const proposalId = await governorContract.proposalCount();
  chai.expect(proposalId).not.to.be.equal(lastProposalId);
  return proposalId;
}

async function proposeAndExecute(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const proposalId = await propose(fixture, governorArgsArray, description);
  await governorContract.connect(governor).queue(proposalId);
  // go forward 3 days
  await advanceTime(3 * 24 * 60 * 60);
  await governorContract.connect(governor).execute(proposalId);
}

// Ugly hack to avoid running these tests when running `npx hardhat test` directly.
// A right way would be to add suffix to files and use patterns to filter
const forkOnlyDescribe = (title, fn) =>
  isForkTest ? mocha.describe(title, fn) : mocha.describe.skip(title, fn);

module.exports = {
  ousdUnits,
  oethUnits,
  usdtUnits,
  usdcUnits,
  tusdUnits,
  daiUnits,
  ognUnits,
  ethUnits,
  fraxUnits,
  oracleUnits,
  cDaiUnits,
  cUsdcUnits,
  frxETHUnits,
  units,
  daiUnitsFormat,
  ousdUnitsFormat,
  usdcUnitsFormat,
  usdtUnitsFormat,
  humanBalance,
  expectApproxSupply,
  advanceTime,
  getBlockTimestamp,
  isMainnet,
  isFork,
  isTest,
  isSmokeTest,
  isLocalhost,
  isMainnetOrFork,
  isForkTest,
  isForkWithLocalNode,
  loadFixture,
  getOracleAddress,
  setOracleTokenPriceUsd,
  getOracleAddresses,
  getAssetAddresses,
  governorArgs,
  proposeArgs,
  propose,
  proposeAndExecute,
  advanceBlocks,
  isWithinTolerance,
  changeInBalance,
  forkOnlyDescribe,
  differenceInErc20TokenBalance,
  differenceInErc20TokenBalances,
  differenceInStrategyBalance,
  fundAccount,
};
