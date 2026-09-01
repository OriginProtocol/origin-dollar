const hre = require("hardhat");

const isFork = process.env.FORK === "true";
const isMainnet = hre.network.name === "mainnet";

module.exports = {
  isFork,
  isMainnet,
};
