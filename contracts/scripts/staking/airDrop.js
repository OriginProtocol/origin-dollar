// Script for generating a merkle tree root hash and the proof corrosponding to each drop
//  inspired by https://github.com/ricmoo/ethers-airdrop
//
// Usage:
//  - Run:
//      node airDrop.js <inputPayoutFile> <outputPayoutFile>
//
//   inputPayoutFormat:
//      {
//        type:<Number>, // The type of payout >0
//        rate:<Number>, // The rate of payout in % (ie 5.5 for 5.5%)
//        duration:<Number>, // duration in seconds
//        payouts:[[<payer:Address>, <amount:Number>]...] // Amount in dollars 5.50 is $5.50
//      }
//
//
//
const { ethers } = require("hardhat");
const { utils } = require("ethers");
const { formatUnits } = utils;
const fs = require("fs");

const { parseCsv } = require("../../utils/fileSystem");
const { compensationData } = require("../staking/constants");
const {
  extractOGNAmount,
  getTotals,
  computeRootHash,
  computeMerkleProof,
} = require("../../utils/stake");

async function airDropPayouts(contractAddress, payoutList) {
  const { rate, type, duration, payouts } = payoutList;
  const o = {};
  for (let index = 0; index < payouts.length; index++) {
    const payout = payouts[index];
    o[payout.address] = {
      ...payout,
      index,
      type,
      duration,
      rate,
      proof: computeMerkleProof(
        contractAddress,
        extractOGNAmount(payoutList),
        index
      ),
    };
  }
  return o;
}

async function main() {
  if (process.argv.length < 4) {
    console.log(`Usage: node airDrop.js <inputJSONFile> <outputJSONFile>`);
  }

  const contractAddress = (await ethers.getContract("OGNStakingProxy")).address;
  console.log(`Contract address used to generate proofs: ${contractAddress}`);

  const payouts = await parseCsv("./scripts/staking/reimbursements.csv");
  const payoutList = {
    ...compensationData,
    rate: utils
      .parseUnits((compensationData.rate / 100.0).toString(), 18)
      .toString(),
    payouts,
  };
  const extractedPayoutList = extractOGNAmount(payoutList);

  const root = computeRootHash(contractAddress, extractedPayoutList);

  console.log("Root hash:", root.hash, " Proof depth:", root.depth);
  const { total, reward } = getTotals(extractedPayoutList);
  console.log(
    `Principal total: ${formatUnits(total, 18)} staking interest: ${formatUnits(
      reward,
      18
    )} total: ${formatUnits(total.add(reward), 18)}`
  );
  const output = await airDropPayouts(contractAddress, payoutList);

  fs.writeFileSync(process.argv[3], JSON.stringify(output));
}

module.exports = {
  airDropPayouts,
};

// Run the job.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
