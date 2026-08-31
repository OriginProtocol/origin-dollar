const hre = require("hardhat");
const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers").utils;

const isFork = process.env.FORK === "true";
const isMainnet = hre.network.name === "mainnet";

function ognUnits(amount) {
  return parseUnits(amount, 18);
}

function ousdUnits(amount) {
  return parseUnits(amount, 18);
}

function usdcUnits(amount) {
  return parseUnits(amount, 6);
}

function usdtUnits(amount) {
  return parseUnits(amount, 6);
}

async function advanceBlocks(numBlocks) {
  let blocksHex = BigNumber.from(numBlocks).toHexString();
  blocksHex = blocksHex.replace(/^0x0+/, "0x");
  await hre.network.provider.send("hardhat_mine", [blocksHex]);
}

module.exports = {
  advanceBlocks,
  isFork,
  isMainnet,
  ognUnits,
  ousdUnits,
  usdcUnits,
  usdtUnits,
};
