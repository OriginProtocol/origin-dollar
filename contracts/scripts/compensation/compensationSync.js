/*
    Verifies that onchain compensation setup matches spreadsheet
*/

const process = require("process");
const fs = require("fs");
const { ethers, getNamedAccounts } = require("hardhat");
const { parseUnits } = ethers.utils;
const { isMainnet, isRinkeby } = require("../../test/helpers.js");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;
// Number of account claims to set per transaction
// Each costs approximately 25,000 gas
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
  console.log(`Expected total ${expectedTotal}`);
  console.log(`Actual total   ${actualTotal}`);
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
  const RE = /^([^,]+),([0-9.]+)/;
  let lines = fs.readFileSync(filename, "utf8").split("\n");
  lines.shift();
  lines = lines.filter((x) => x.length > 2);
  return lines.map((line) => {
    const match = line.match(RE);
    return {
      address: match[1],
      amount: parseUnits(match[2], 18),
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
  let t = parseUnits("0", 18);
  for (const account of accounts) {
    t = t.add(account.amount);
  }
  return t;
}

async function uploadAccounts(accounts) {
  const addresses = accounts.map((x) => x.address);
  const amounts = accounts.map((x) => x.amount);
  const batchTotal = total(accounts);
  console.log(
    `Uploading batch of ${addresses.length} accounts. Total: ${batchTotal}`
  );
  const tx = await contract.setClaims(addresses, amounts);
  console.log("Sent. tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await ethers.provider.waitForTransaction(
    tx.hash,
    NUM_CONFIRMATIONS
  );
  console.log(`Propose tx confirmed. Gas usage ${receipt.gasUsed}`);
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

async function main() {
  const args = parseArgv();
  contract = await getContract();
  if (!contract) {
    console.log("Could not connect to contract");
    return;
  }

  const expected = fromCsv(args["--data-file"]);
  const results = await verify(expected);

  if (results.isCorrect) {
    console.log("Verification successful. No further work needed.");
    return;
  }

  if (!args["--do-it"]) {
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
    await uploadAccounts(batch);
    i += 1;
  }

  const afterResults = await verify(expected);
  if (!afterResults.isCorrect) {
    console.log("Totals do not match after upload");
    return;
  }

  console.log("Upload successful");
}

main();
