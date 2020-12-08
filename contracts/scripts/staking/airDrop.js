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
const ethers = require("ethers");
const fs = require("fs");
const { utils } = ethers;

function hash(index, address, type, duration, rate, amount) {
  return ethers.utils.solidityKeccak256(
    ['uint', 'uint8', 'address', 'uint', 'uint', 'uint'],
    [index, type, address, duration, rate, amount]
  );
}

function reduceMerkleBranches(leaves) {
    var output = [];

    while (leaves.length) {
        var left = leaves.shift();
        var right = (leaves.length === 0) ? left: leaves.shift();
        output.push(ethers.utils.keccak256(ethers.utils.concat([ left, right ])));
    }

    output.forEach(function(leaf) {
        leaves.push(leaf);
    });
}

function getLeaves(payoutList) {
  const { type, duration, rate, payouts } = payoutList;
  const solRate = utils.parseUnits((rate / 100.0).toString(), 18);

  return payouts.map(function(payout, i) {
      const solAmount = utils.parseUnits(payout[1].toString(), 18);
      return hash(i, payout[0], type, duration, solRate, solAmount);
  });
}

function computeRootHash(payoutList) {
    var leaves = getLeaves(payoutList);
    let depth = 0;
    while (leaves.length > 1) {
      reduceMerkleBranches(leaves);
      depth ++;
    }

    return {hash:leaves[0], depth};
}

function computeMerkleProof(payoutList, index) {
    const leaves = getLeaves(payoutList);

    if (index == null) { throw new Error('address not found'); }

    var path = index;

    var proof = [ ];
    while (leaves.length > 1) {
        if ((path % 2) == 1) {
            proof.push(leaves[path - 1])
        } else {
            proof.push(leaves[(path+1) < leaves.length ? path + 1 : path])
        }

        // Reduce the merkle tree one level
        reduceMerkleBranches(leaves);

        // Move up
        path = parseInt(path / 2);
    }

    return proof;
}

async function airDropPayouts(payoutList) {
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
      proof:computeMerkleProof(
        payoutList,
        index
      ),
    };
  }
  return o;
}

async function main() {
  if (process.argv.length < 4) {
    console.log(
      `Usage: node airDrop.js <inputJSONFile> <outputJSONFile>`
    );
  }

  const inputFileLocation = process.argv[2]
  const outputFileLocation = process.argv[3]
  const payoutList = require("./" + inputFileLocation);
  const root = computeRootHash(payoutList);
  console.log("Root hash:", root.hash, " Proof depth:", root.depth);
  const output = await airDropPayouts(payoutList);
  console.log(`Input read from: ${inputFileLocation} Output file location: ${outputFileLocation}`)
  fs.writeFileSync(outputFileLocation, JSON.stringify(output));
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
