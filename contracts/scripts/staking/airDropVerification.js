// Script for generating a merkle tree root hash and the proof corrosponding to each drop
// Usage:
//  - Run:
//      node airDropVerification.js <rootNodeHash> <treeDepth>
//
//
//
const { ethers } = require("hardhat");
const { utils, BigNumber } = require("ethers");
const { formatUnits } = utils;
const fs = require("fs");
const { verifyMerkleSignature } = require("../../utils/stake");

async function main() {
  if (process.argv.length < 4) {
    console.log(
      `Usage: node airDropVerification.js <rootNodeHash> <treeDepth>`
    );
  }

  const rootHash = process.argv[2];
  const treeDepth = parseInt(process.argv[3]);
  const contractAddress = (await ethers.getContract("OGNStakingProxy")).address;
  const merkleProofAccounts = JSON.parse(
    fs.readFileSync(`${__dirname}/merkleProofedAccountsToBeCompensated.json`)
  );
  const accountData = Object.values(merkleProofAccounts);
  let totalOGN = BigNumber.from("0");

  accountData.forEach((merkleData, i) => {
    const proofValid = verifyMerkleSignature(
      rootHash,
      treeDepth,
      contractAddress,
      merkleData.address,
      BigNumber.from(merkleData.index),
      BigNumber.from(merkleData.type),
      BigNumber.from(merkleData.duration),
      BigNumber.from(merkleData.rate),
      BigNumber.from(merkleData.ogn_compensation),
      merkleData.proof
    );

    totalOGN = totalOGN.add(BigNumber.from(merkleData.ogn_compensation));
    const icon = proofValid ? "🟢" : "🔴";
    console.log(
      `${icon} ${i}/${accountData.length} ${merkleData.address} ${formatUnits(
        merkleData.ogn_compensation,
        18
      )} OGN`
    );
  });
  console.log(`Total: ${formatUnits(totalOGN, 18)}`);
}

// Run the job.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
