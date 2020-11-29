// Script for verifying against etherscan.
//
// Usage:
//  - Setup your environment
//      export STAKING_PK=<private key of the staking signer>
//  - Run:
//      node signStakingPayout.js <inputPayoutFile> <outputPayoutFile>
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

const TEST_STAKING_PK =
  "0x345c8d05224b66bab10e9f952dc1d332e59e062be5990f87206a67e4545e132d";
const STAKING_KEY = "0x5195f035B980B265C9cA9A83BD8A498dd9160Dff";

const STAKING_PK = process.env.STAKING_PK || TEST_STAKING_PK;
const wallet = new ethers.Wallet(STAKING_PK);

async function signForStaking(type, address, duration, rate, amount) {
  // this should be 117 bytes of data
  const message = utils.solidityPack(
    ["uint8", "address", "uint", "uint", "uint"],
    [type, address, duration, rate, amount]
  );
  const messageBinary = utils.arrayify(message);
  return wallet.signMessage(messageBinary);
}

async function signPayouts(payoutList) {
  //import a list of addresses that we want to payout to
  const { type, duration, rate, payouts } = payoutList;

  const o = {};

  for (const p of payouts) {
    const [address, amount] = p;
    const solRate = utils.parseUnits((rate / 100.0).toString(), 18);
    const solAmount = utils.parseUnits(amount.toString(), 18);
    o[address] = {
      type,
      duration,
      rate: solRate.toString(),
      amount: solAmount.toString(),
      signature: await signForStaking(
        type,
        address,
        duration,
        solRate,
        solAmount
      ),
    };
  }
  return o;
}

async function main() {
  if (process.argv.length < 4) {
    console.log(
      `Usage: node signStakingPayout.js <inputJSONFile> <outputJSONFile>`
    );
  }

  const output = await signPayouts(require("./" + process.argv[2]));

  fs.writeFileSync(process.argv[3], JSON.stringify(output));
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
