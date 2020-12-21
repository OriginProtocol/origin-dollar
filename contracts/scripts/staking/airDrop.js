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
const { utils } = require("ethers");
const fs = require("fs");

function hash(index, contract, address, type, duration, rate, amount) {
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
  const { type, duration, rate, payouts } = payoutList;

  let total = 0;
  let reward = 0;
  for (const [payer, payout] of payouts) {
    total += payout;
    reward += (payout * rate) / 100.0;
  }
  return { total, reward };
}

function getLeaves(contractAddress, payoutList) {
  const { type, duration, rate, payouts } = payoutList;
  const solRate = utils.parseUnits((rate / 100.0).toString(), 18);

  return payouts.map(function (payout, i) {
    const solAmount = utils.parseUnits(payout[1].toString(), 18);
    return hash(
      i,
      contractAddress,
      payout[0],
      type,
      duration,
      solRate,
      solAmount
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
  const { type, duration, rate, payouts } = payoutList;
  const solRate = utils.parseUnits((rate / 100.0).toString(), 18);
  //import a list of addresses that we want to payout to
  //
  const o = {};
  for (let index = 0; index < payouts.length; index++) {
    const [address, amount] = payouts[index];
    const solAmount = utils.parseUnits(amount.toString(), 18);
    o[address] = {
      index,
      type,
      duration,
      rate: solRate.toString(),
      amount: solAmount.toString(),
      proof: computeMerkleProof(contractAddress, payoutList, index),
    };
  }
  return o;
}

async function main() {
  if (process.argv.length < 4) {
    console.log(`Usage: node airDrop.js <inputJSONFile> <outputJSONFile>`);
  }

  const contractAddress = (await ethers.getContract("OGNStakingProxy")).address;

  const payoutList = require("./" + process.argv[2]);
  const root = computeRootHash(contractAddress, payoutList);
  console.log("Root hash:", root.hash, " Proof depth:", root.depth);
  const { total, reward } = getTotals(payoutList);
  console.log(
    "Payout total: ",
    total,
    " reward:",
    reward,
    " total outstanding:",
    total + reward
  );
  const output = await airDropPayouts(contractAddress, payoutList);

  fs.writeFileSync(process.argv[3], JSON.stringify(output));
}

module.exports = {
  computeRootHash,
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
