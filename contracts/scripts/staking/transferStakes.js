// Script for verifying against etherscan.
//
// Usage:
//  - Run:
//      node transferStakes.js <PrivateKey> <fromAddress> <toAddress> <r> <s> <v>
//
//
//
const { ethers } = require("hardhat");
const { utils, BigNumber, Wallet } = require("ethers");
const { getTxOpts } = require("../../utils/tx");
const fs = require("fs");

async function doTransfer(pk, fromAddress, toAddress, r, s, v) {
  const wallet = new Wallet(pk, ethers.provider);
  const proxyAddress = (await ethers.getContract("OGNStakingProxy")).address;
  const contract = await ethers.getContractAt(
    "SingleAssetStaking",
    proxyAddress
  );

  await contract
    .connect(wallet)
    .transferStakes(fromAddress, toAddress, r, s, v, { gasLimit: 9000000000 });
}

async function main() {
  const { argv } = process;
  if (argv.length < 8) {
    console.log(
      `Usage: node transferStakes.js <PK> <fromAddress> <targetAddress> <r> <s> <v>`
    );
    return;
  }

  await doTransfer(argv[2], argv[3], argv[4], argv[5], argv[6], argv[7]);
  console.log(`transfer complete`);
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
