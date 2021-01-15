/*
    Verifies that onchain compensation setup matches spreadsheet
*/

const process = require("process");
const fs = require("fs");
const { ethers, getNamedAccounts } = require("hardhat");
const { parseUnits } = ethers.utils;

const { withConfirmation } = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");

const BATCH_SIZE = 100;

let contract;

async function verify(expectedAccounts) {
  let isCorrect = true;
  let correct = [];
  let incorrect = [];

  let i = 1;
  for (const account of expectedAccounts) {
    const actual = await getBlockchainBalanceOf(account);
    const expected = account.amount;
    const accountIsCorrect = actual.eq(expected);
    const icon = accountIsCorrect ? "🟢" : "🔴";
    const totalText = `A: ${actual} E: ${expected}`;
    console.log(
      `${icon} ${i}/${expectedAccounts.length} ${account.address} ${totalText}`
    );
    if (accountIsCorrect) {
      correct.push(account);
    } else {
      isCorrect = false;
      incorrect.push(account);
    }
    i += 1;
  }

  const expectedTotal = total(expectedAccounts);
  const actualTotal = await getBlockchainTotal();
  console.log(
    `Expected total (from csv file): ${await ethers.utils.formatUnits(
      expectedTotal,
      18
    )} OUSD`
  );
  console.log(
    `Actual total (contract state): ${await ethers.utils.formatUnits(
      actualTotal,
      18
    )} OUSD`
  );
  if (!expectedTotal.eq(actualTotal)) {
    isCorrect = false;
  }
  return {
    isCorrect,
    actualTotal,
    incorrect,
    correct,
  };
}

function fromCsv(filename) {
  console.log(`Reading file ${filename}`);
  const RE = /^([^,]+),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),([0-9.]+),([0-9.]+),([0-9.]+)/;
  let lines = fs.readFileSync(filename, "utf8").split("\n");
  lines.shift();
  lines = lines.filter((x) => x.length > 2);
  return lines.map((line) => {
    const match = line.match(RE);
    return {
      address: match[1],
      amount: parseUnits(match[7], 0),
    };
  });
}

function splitIntoBatches(accounts, batchSize) {
  const batches = [];
  let batch = undefined;
  for (i in accounts) {
    if (i % batchSize == 0) {
      if (batch) {
        batches.push(batch);
      }
      batch = [];
    }
    batch.push(accounts[i]);
  }
  if (batch) {
    batches.push(batch);
  }
  return batches;
}

function total(accounts) {
  let t = parseUnits("0", 0);
  for (const account of accounts) {
    t = t.add(account.amount);
  }
  return t;
}

async function uploadAccounts(accounts, signer) {
  const addresses = accounts.map((x) => x.address);
  const amounts = accounts.map((x) => x.amount);
  const batchTotal = total(accounts);
  console.log(
    `Uploading batch of ${addresses.length} accounts. Total: ${batchTotal}`
  );
  const result = await withConfirmation(
    contract.connect(signer).setClaims(addresses, amounts, await getTxOpts())
  );
  console.log("Confirmed. tx hash:", result.hash);
}

async function getBlockchainTotal() {
  return await contract.totalClaims();
}

async function getBlockchainBalanceOf(account) {
  return await contract.balanceOf(account.address);
}

async function getContract() {
  return (contract = await ethers.getContract("CompensationClaims"));
}

// Util to parse Argv
function parseArgv() {
  const args = {};
  for (const arg of process.argv) {
    const elems = arg.split("=");
    const key = elems[0];
    const val = elems.length > 1 ? elems[1] : true;
    args[key] = val;
  }
  return args;
}

async function compensationSync(compContract, dataFileLocation, doIt, signer) {
  contract = compContract;
  if (!contract) {
    console.log("Could not connect to contract");
    return;
  }

  const expected = fromCsv(dataFileLocation);
  const results = await verify(expected);

  if (results.isCorrect) {
    console.log("Verification successful. No further work needed.");
    return;
  }

  if (!doIt) {
    console.log("Use the --do-it flag to upload the account information.");
    return;
  }

  if (results.incorrect.length == 0) {
    console.log("All accounts have correct amounts, however the total is off.");
    return;
  }

  const batches = splitIntoBatches(results.incorrect, BATCH_SIZE);
  let i = 1;
  for (const batch of batches) {
    console.log(`Uploading batch ${i} of ${batches.length}`);
    await uploadAccounts(batch, signer);
    i += 1;
  }

  const afterResults = await verify(expected);
  if (!afterResults.isCorrect) {
    console.log("Totals do not match after upload");
    return;
  }

  console.log("Upload successful");
}

async function main() {
  const args = parseArgv();
  const dataFileLocation = args["--data-file"];

  const { adjusterAddr } = await getNamedAccounts();
  const signer = ethers.provider.getSigner(adjusterAddr);
  console.log("Using adjuster account", adjusterAddr);

  await getContract();
  console.log("Connecting to OUSD compensation contract", contract.address);

  const doIt = !!args["--do-it"];
  console.log("doIt=", doIt);

  await compensationSync(contract, dataFileLocation, doIt, signer);
}

module.exports = {
  compensationSync,
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
