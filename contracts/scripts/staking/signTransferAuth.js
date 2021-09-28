// Script for verifying against etherscan.
//
// Usage:
//  - Run:
//      node signStakingPayout.js <PrivateKey> <toAddress>
//
//
//
const { ethers } = require("hardhat");
const { utils, BigNumber, Wallet } = require("ethers");
const fs = require("fs");

const TEST_AGENT_PK =
  "0x345c8d05224b66bab10e9f952dc1d332e59e062be5990f87206a67e4545e132d";

async function signForTransfer(pk, toAddress) {
  const wallet = new Wallet(pk);
  const proxyAddress = (await ethers.getContract("OGNStakingProxy")).address;
  const sig = await wallet.signMessage(
    utils.arrayify(
      utils.solidityPack(
        ["string", "address", "address", "address"],
        ["tran", proxyAddress, wallet.address, toAddress]
      )
    )
  );

  console.log("sig is:", sig);

  return {
    proxyAddress,
    address: wallet.address,
    s: utils.splitSignature(sig),
  };
}

async function main() {
  const { argv } = process;
  if (argv.length < 4) {
    console.log(`Usage: node signTransferAuth.js <PK> <targetAddress>`);
    return;
  }

  const { proxyAddress, address, s } = await signForTransfer(argv[2], argv[3]);
  console.log(
    `call ${proxyAddress}.transferStakes('${address}', '${argv[3]}', '${s.r}', '${s.s}', ${s.v})`
  );
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
