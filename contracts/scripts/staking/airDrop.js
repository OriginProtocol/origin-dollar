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
const { ethers, getNamedAccounts } = require("hardhat");
const { utils, BigNumber } = require("ethers");
const { formatUnits } = utils;
const papa = require("papaparse");
const fs = require("fs");

const compensationData = {
  type: 1,
  rate: 25,
  duration: 31104000
}

function hash(index, type, contract, address, duration, rate, amount) {
  return utils.solidityKeccak256(
    ["uint", "uint8", "address", "address", "uint", "uint", "uint"],
    [index, type, contract, address, duration, rate, amount]
  );
}

function reduceMerkleBranches(leaves) {
  var output = [];

  while (leaves.length) {
    var left = leaves.shift();
    var right = leaves.length === 0 ? left : leaves.shift();
    output.push(utils.keccak256(utils.concat([left, right])));
  }

  output.forEach(function (leaf) {
    leaves.push(leaf);
  });
}

function getTotals(payoutList) {
  const { rate, payouts } = payoutList;

  let total = BigNumber.from(0);
  let reward = BigNumber.from(0);
  for (const payout of payouts) {
    total = total.add(payout.ogn_compensation);
    const calReward = BigNumber.from(payout.ogn_compensation).mul(rate).div(100)
    reward = reward.add(calReward);
  }
  return { total, reward };
}

function getLeaves(contractAddress, payoutList) {
  const { type, duration, rate, payouts } = payoutList;

  return payouts.map(function (payout, i) {
    return hash(
      i,
      type,
      contractAddress,
      payout.address,
      duration,
      rate,
      payout.ogn_compensation
    );
  });
}

function computeRootHash(contractAddress, payoutList) {
  var leaves = getLeaves(contractAddress, payoutList);
  let depth = 0;
  while (leaves.length > 1) {
    reduceMerkleBranches(leaves);
    depth++;
  }

  return { hash: leaves[0], depth };
}

function computeMerkleProof(contractAddress, payoutList, index) {
  const leaves = getLeaves(contractAddress, payoutList);

  if (index == null) {
    throw new Error("address not found");
  }

  var path = index;

  var proof = [];
  while (leaves.length > 1) {
    if (path % 2 == 1) {
      proof.push(leaves[path - 1]);
    } else {
      proof.push(leaves[path + 1 < leaves.length ? path + 1 : path]);
    }

    // Reduce the merkle tree one level
    reduceMerkleBranches(leaves);

    // Move up
    path = parseInt(path / 2);
  }

  return proof;
}

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
      proof: computeMerkleProof(contractAddress, payoutList, index),
    };
  }
  return o;
}

async function parseCsv(filePath) {
  const csvFile = fs.readFileSync(filePath);
  const csvData = csvFile.toString();

  return new Promise((resolve) => {
    papa.parse(csvData, {
      header: true,
      complete: ({ data }) => {
        console.log("Complete", data.length, "records.");
        resolve(data);
      },
    });
  });
}

async function main() {
  if (process.argv.length < 4) {
    console.log(`Usage: node airDrop.js <inputJSONFile> <outputJSONFile>`);
  }

  const contractAddress = (await ethers.getContract("OGNStakingProxy")).address;

  const payouts = await parseCsv("./scripts/staking/" + process.argv[2]);
  const payoutList = {
    ...compensationData,
    payouts,
  };
  const solRate = utils.parseUnits((payoutList.rate / 100.0).toString(), 18);
  payoutList.rate = solRate.toString();

  const root = computeRootHash(contractAddress, payoutList);
  
  console.log("Root hash:", root.hash, " Proof depth:", root.depth);
  const { total, reward } = getTotals(payoutList);
  console.log(`Payout total: ${formatUnits(total, 18)} reward: ${formatUnits(reward, 18)} total: ${formatUnits(total.add(reward), 18)}`)
  const output = await airDropPayouts(contractAddress, payoutList);

  fs.writeFileSync(process.argv[3], JSON.stringify(output));
}

module.exports = {
  computeRootHash,
  airDropPayouts,
  parseCsv,
  compensationData
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
