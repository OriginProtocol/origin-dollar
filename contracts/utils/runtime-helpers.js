const { getNetworkName } = require("../tasks/lib/network");

const isFork = process.env.FORK === "true";
const isMainnet = getNetworkName() === "mainnet" && !isFork;

module.exports = {
  isFork,
  isMainnet,
};
