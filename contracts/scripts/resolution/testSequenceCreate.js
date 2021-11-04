const fs = require("fs");

async function main(config) {
  if (!config.testFile) {
    throw new Error("Must specify --testFile");
  }
  if (!config.upgradeFile) {
    throw new Error("Must specify --upgradeFile");
  }

  let transactions = [];

  const data = JSON.parse(fs.readFileSync(config.upgradeFile));
  let accounts = data.addresses;
  // Sort all, biggest accounts to smallest
  accounts.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));

  // Pair every account, highest with lowest, second highest, with second lowest
  // But save some at the end
  // Send funds from big account to smaller account
  halfway = Math.floor((accounts.length - 2) / 2);
  console.log(halfway);
  for (let i = 0; i < halfway; i++) {
    const high = accounts[i];
    const low = accounts[accounts.length - 2 - i];
    const highBalance = high[1];

    const choice = Math.random() * 100;
    let amount = highBalance;
    if (choice < 30) {
      amount = 1 + Math.floor(Math.random() * 12);
    } else if (choice < 70) {
      amount = amount.substr(0, amount.length - 1);
    }
    const row = [high[0], low[0], amount.toString()];
    transactions.push(row);
    console.log(...row);
  }
  fs.writeFileSync(config.testFile, JSON.stringify(transactions));
  console.log("Test file written");
}

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

// Parse config.
const args = parseArgv();
const config = {
  testFile: args["--testFile"],
  upgradeFile: args["--upgradeFile"],
};

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
