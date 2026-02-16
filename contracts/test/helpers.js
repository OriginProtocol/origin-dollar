const hre = require("hardhat");
const chai = require("chai");
const { parseUnits, formatUnits, keccak256, toUtf8Bytes } =
  require("ethers").utils;
const { BigNumber } = require("ethers");

const addresses = require("../utils/addresses");
const { decimalsFor, units } = require("../utils/units");

/**
 * Checks if the actual value is inclusively within a min and max range of values.
 */
chai.Assertion.addMethod("withinRange", function (min, max, message) {
  const actual = this._obj;
  min = BigNumber.from(min);

  chai.expect(actual, message).gte(min);
  chai.expect(actual, message).lte(max);
});

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
    const address = user.address || user.getAddress() || user; // supports contracts too
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

chai.Assertion.addMethod("totalSupply", async function (expected, message) {
  const contract = this._obj;
  const actual = await contract.totalSupply();
  if (!BigNumber.isBigNumber(expected)) {
    expected = parseUnits(expected, await decimalsFor(contract));
  }
  chai.expect(actual).to.equal(expected, message);
});

chai.Assertion.addMethod(
  "assetBalanceOf",
  async function (expected, asset, message) {
    const strategy = this._obj;
    const assetAddress = asset.address || asset.getAddress();
    const actual = await strategy["checkBalance(address)"](assetAddress);
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
  chai.expect(log, `Failed to find event "${eventName}" on the tx`).to.exist;

  if (Array.isArray(args)) {
    chai
      .expect(log.args.length)
      .to.equal(args.length, `Invalid arg count of event ${eventName}`);
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "function") {
        args[i](log.args[i]);
      } else {
        chai
          .expect(log.args[i], `Failed to match arg ${i} of event ${eventName}`)
          .to.equal(args[i]);
      }
    }
  }
});

chai.Assertion.addMethod(
  "revertedWithCustomError",
  async function (errorSignature) {
    let txSucceeded = false;
    try {
      await this._obj;
      txSucceeded = true;
    } catch (e) {
      const errorHash = keccak256(toUtf8Bytes(errorSignature)).substr(0, 10);
      const errorName = errorSignature.substring(
        0,
        errorSignature.indexOf("(")
      );

      const containsError =
        e.message.includes(errorHash) || e.message.includes(errorName);

      if (!containsError) {
        chai.expect.fail(
          `Expected error message with signature ${errorSignature} but another was thrown: ${e.message}`
        );
      }
    }

    if (txSucceeded) {
      chai.expect.fail(`Expected ${errorSignature} error but none was thrown`);
    }
  }
);

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
const isHolesky = hre.network.name == "holesky";
const isExternalNet = isMainnet || isHolesky;
const isTest = process.env.IS_TEST === "true";
const isSmokeTest = process.env.SMOKE_TEST === "true";
const isMainnetOrFork =
  isMainnet || (isFork && hre.network.config.chainId == 1);
const isForkTest = isFork && isTest;
const isMainnetForkTest = isForkTest && hre.network.config.chainId == 1;
const isForkWithLocalNode = isFork && process.env.LOCAL_PROVIDER_URL;
const isArbitrumOne = hre.network.name == "arbitrumOne";
const isTestnetSimplifiedDeploy = isHolesky;
const isArbFork = isFork && process.env.FORK_NETWORK_NAME == "arbitrumOne";
const isHoleskyFork = isFork && hre.network.config.chainId == 17000;
const isHoleskyOrFork = isHolesky || isHoleskyFork;
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
  let blocksHex = BigNumber.from(numBlocks).toHexString();

  // Note: Hardhat's `QUANTITY` type doesn't support leading zeros
  // Not sure why but it seems to be a bug. So we gotta remove
  // any leading zeros from hex values
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
      SSV: addresses.mainnet.SSV,
      SSVNetwork: addresses.mainnet.SSVNetwork,
      beaconChainDepositContract: addresses.mainnet.beaconChainDepositContract,
    };
  } else if (isHoleskyOrFork) {
    return {
      WETH: addresses.holesky.WETH,
      SSV: addresses.holesky.SSV,
      SSVNetwork: addresses.holesky.SSVNetwork,
      beaconChainDepositContract: addresses.holesky.beaconChainDepositContract,
    };
  } else if (isHoodiOrFork) {
    return {
      WETH: addresses.hoodi.WETH,
      SSV: addresses.hoodi.SSV,
      SSVNetwork: addresses.hoodi.SSVNetwork,
      beaconChainDepositContract: addresses.hoodi.beaconChainDepositContract,
    };
  } else {
    const addressMap = {
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
      SSV: (await deployments.get("MockSSV")).address,
      SSVNetwork: (await deployments.get("MockSSVNetwork")).address,
      beaconChainDepositContract: (await deployments.get("MockDepositContract"))
        .address,
    };

    return addressMap;
  }
};

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
 * Calculates the change in balance after a function has been executed on a contract
 * @param {Function} functionChangingBalance - The function that changes the balance
 * @param {[Object]} tokens - The token contract
 * @param {[string]} accounts - An array of addresses
 **/
async function changeInMultipleBalances(
  functionChangingBalance,
  tokens,
  accounts
) {
  const _getBalances = async () => {
    const out = {};

    for (const account of accounts) {
      out[account] = {};

      const balances = await Promise.all(
        tokens.map((t) => t.balanceOf(account))
      );

      for (let i = 0; i < balances.length; i++) {
        out[account][tokens[i].address] = balances[i];
      }
    }

    return out;
  };

  const balanceBefore = await _getBalances();

  await functionChangingBalance();

  const balanceAfter = await _getBalances();

  const balanceDiff = {};
  for (const account of accounts) {
    balanceDiff[account] = {};
    for (const token of tokens) {
      const tokenAddr = token.address;
      balanceDiff[account][tokenAddr] =
        balanceAfter[account][tokenAddr] - balanceBefore[account][tokenAddr];
    }
  }

  return balanceDiff;
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
    balancesBefore[i] = await strategyContracts[i]["checkBalance(address)"](
      assetAddresses[i]
    );
  }
  await asyncFn();

  for (let i = 0; i < arrayLength; i++) {
    returnVals[i] = (
      await strategyContracts[i]["checkBalance(address)"](assetAddresses[i])
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
  humanBalance,
  expectApproxSupply,
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
  isHolesky,
  isHoleskyFork,
  isHoleskyOrFork,
  isTestnetSimplifiedDeploy,
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
  getAssetAddresses,
  governorArgs,
  proposeArgs,
  advanceBlocks,
  isWithinTolerance,
  changeInBalance,
  changeInMultipleBalances,
  differenceInErc20TokenBalance,
  differenceInErc20TokenBalances,
  differenceInStrategyBalance,
};
