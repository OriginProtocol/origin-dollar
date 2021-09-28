// Script for verifying against etherscan.
//
// Usage:
//  - Run:
//      node signStakingPayout.js <PrivateKey> <fromAddress> <toAddress>
//
//
//
const { ethers } = require("hardhat");
const { utils, BigNumber, Wallet } = require("ethers");
const fs = require("fs");

const TEST_AGENT_PK =
  "0x345c8d05224b66bab10e9f952dc1d332e59e062be5990f87206a67e4545e132d";

async function signForTransfer(pk, fromAddress, toAddress) {
  const wallet = new Wallet(pk);
  const proxyAddress = (await ethers.getContract("OGNStakingProxy")).address;
  const sig = await wallet.signMessage(
    utils.arrayify(
      utils.solidityPack(
        ["string", "address", "address", "address"],
        ["tran", proxyAddress, fromAddress, toAddress]
      )
    )
  );

  console.log("sig is:", sig);

  return { proxyAddress, s: utils.splitSignature(sig) };
}

async function main() {
  const { argv } = process;
  if (argv.length < 5) {
    console.log(
      `Usage: node signTransferAuth.js <PK> <fromAddress> <targetAddress>`
    );
    return;
  }

  const { proxyAddress, s } = await signForTransfer(argv[2], argv[3], argv[4]);
  console.log(
    `call ${proxyAddress}.transferStakes('${argv[4]}', '${s.r}', '${s.s}', ${s.v})`
  );
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
