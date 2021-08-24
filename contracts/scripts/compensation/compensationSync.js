/*
    Verifies that onchain compensation setup matches spreadsheet
*/
const process = require("process");
const fs = require("fs");
const { ethers, getNamedAccounts } = require("hardhat");
const { BigNumber } = ethers;
const { parseUnits } = ethers.utils;

const { withConfirmation } = require("../../utils/deploy");
const { hashFileContents } = require("../../utils/fileSystem");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

const BATCH_SIZE = 100;
let ousdContract;
let contract;

async function verify(expectedAccounts, dataFileLocation) {
  let isCorrect = true;
  let correct = [];
  let incorrect = [];

  let i = 1;
  console.log(
    `LEGEND:\nwallet state exact: 🟢\nwallet state larger than expected: 🟣\ncontract balance correct: 🟠\nwallet state incorrect: 🔴`
  );
  for (const account of expectedAccounts) {
    const actual = await getBlockchainBalanceOf(account);
    const expected = account.amount;
    const walletAmount = await ousdContract.balanceOf(account.address);
    const contractStateCorrect = actual.eq(expected);

    // Because of rebasing logic of OUSD the amounts are not going to be completely exact
    const walletStateExact = walletAmount
      .sub(expected)
      .abs()
      .lt(BigNumber.from("5"));

    const walletStateBigger = walletAmount
      .sub(expected)
      .gte(BigNumber.from("0"));

    let icon = "🔴";
    if (walletStateExact) {
      icon = "🟢";
    } else if (contractStateCorrect) {
      icon = "🟠";
    } else if (walletStateBigger) {
      icon = "🟣";
    }

    const totalText = `Wallet: ${walletAmount} Contract: ${actual} Csv: ${expected}`;
    console.log(
      `${icon} ${i}/${expectedAccounts.length} ${account.address} ${totalText}`
    );
    if (contractStateCorrect) {
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

  console.log(
    `Input csv ${dataFileLocation} hash: ${await hashFileContents(
      dataFileLocation
    )}`
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
  const RE =
    /^([^,]+),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),(\"?[\d,\.]*\"?),([0-9.]+),([0-9.]+),([0-9.]+)/;
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
  ousdContract = await ethers.getContractAt(
    "OUSD",
    addresses.mainnet.OUSDProxy
  );
  if (!contract) {
    console.log("Could not connect to contract");
    return;
  }

  const expected = fromCsv(dataFileLocation);
  const results = await verify(expected, dataFileLocation);

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

  const afterResults = await verify(expected, dataFileLocation);
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
