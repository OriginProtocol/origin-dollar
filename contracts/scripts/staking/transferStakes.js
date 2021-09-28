// Script for verifying against etherscan.
//
// Usage:
//  - Run:
//      node signStakingPayout.js <PrivateKey> <fromAddress> <toAddress> <r> <s> <v>
//
//
//
const { ethers } = require("hardhat");
const { utils, BigNumber, Wallet } = require("ethers");
const { getTxOpts } = require("../../utils/tx");
const fs = require("fs");

const TEST_AGENT_PK =
  "0x345c8d05224b66bab10e9f952dc1d332e59e062be5990f87206a67e4545e132d";

async function doTransfer(pk, fromAddress, toAddress, r, s, v) {
  const wallet = new Wallet(pk, ethers.provider);
  const proxyAddress = (await ethers.getContract("OGNStakingProxy")).address;
  const contract = await ethers.getContractAt(
    "SingleAssetStaking",
    proxyAddress
  );

  const ops = await getTxOpts();
  ops.gasLimit = 6000000;
  ops.gasPrice = 9000000000;

  await contract
    .connect(wallet)
    .transferStakes(fromAddress, toAddress, r, s, v, ops);
}

async function main() {
  const { argv } = process;
  if (argv.length < 8) {
    console.log(
      `Usage: node signTransferAuth.js <PK> <fromAddress> <targetAddress> <r> <s> <v>`
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
