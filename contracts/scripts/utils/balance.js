// Script to check OUSD balance and credits for an account
//
// Usage:
//  - Setup your environment:
//      export BUIDLER_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//  - Then run:
//      node balance.js --addr=<wallet_address>

const { ethers } = require("@nomiclabs/buidler");
const { utils } = require("ethers");
const { formatUnits } = utils;
const addresses = require("../../utils/addresses");

async function main() {
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const balance = await ousd.balanceOf(config.addr);
  const credits = await ousd.creditsBalanceOf(config.addr);
  console.log("OUSD balance=", formatUnits(balance.toString(), 18));
  console.log("OUSD credits=", formatUnits(credits.toString(), 18));
}

function parseArgv() {
  const args = {};
  for (const arg of process.argv) {
    const elems = arg.split("=");
    const key = elems[0];
    const val = elems.length > 1 ? elems[1] : true;
    args[key] = val;
  }
  return args;
}

// Parse config.
const args = parseArgv();
const config = {
  verbose: args["--verbose"] === "true" || false,
  addr: args["--addr"],
};
console.log("Config:");
console.log(config);

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
