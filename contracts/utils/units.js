const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers").utils;

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
 * Scales an amount up to 18 decimals. eg 6 decimals to 18 decimals
 * @returns
 */
async function scaleAmount(amount, contract) {
  const decimals = await decimalsFor(contract);
  return BigNumber.from(amount).mul(BigNumber.from("10").pow(18 - decimals));
}

/**
 * Converts an amount in the base unit of a contract to the standard decimal unit for the contract.
 * @param {string} amount - The amount to convert, represented as a string in the base unit of the contract.
 * @param {Contract} contract - The token contract to get the decimal places for.
 */
async function units(amount, contract) {
  return parseUnits(amount, await decimalsFor(contract));
}

/**
 * Converts a scaled amount or non scaled amount to a BigNumber.
 * @param {*} amount can be a number, float or string
 * @param {number} decimals
 * @returns
 */
const convertToBigNumber = (amount, decimals = 18) => {
  const amountStr = amount.toString();
  return amountStr.length >= decimals - 3
    ? BigNumber.from(amountStr)
    : parseUnits(amountStr, decimals);
};

const toHex = (buff) => {
  return "0x" + Buffer.from(buff).toString("hex");
};

module.exports = {
  decimalsFor,
  scaleAmount,
  units,
  convertToBigNumber,
  toHex,
};
