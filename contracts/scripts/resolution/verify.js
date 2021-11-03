const fs = require("fs");

const { ethers } = require("hardhat");
const addresses = require("../../utils/addresses");

const OUSD_ADDRESS = addresses.mainnet.OUSDProxy;
const E18 = "1000000000000000000";
const E27 = "1000000000000000000000000000";
BATCH_SIZE = 50;

async function main(config) {
  if (!config.addressesFile) {
    throw new Error("Must specify addressesFile");
  }

  const filedata = fs.readFileSync(config.addressesFile);
  const addresses = JSON.parse(filedata)["addresses"];

  console.log("Verifying Accounts");
  const ousd = await ethers.getContractAt("OUSD", OUSD_ADDRESS);
  console.log("Using OUSD at @", ousd.address);

  let globalRCPT = undefined;
  if (config.highres) {
    globalRCPT = await ousd.rebasingCreditsPerTokenHighres();
  } else {
    globalRCPT = await ousd.rebasingCreditsPerToken();
  }
  console.log("Global ", globalRCPT.toString());

  console.log("---------");

  let calcSupply = undefined;
  let calcRebasingCredits = undefined;
  let calcNonRebasingSupply = undefined;
  const toUpgrade = [];

  for (const i in addresses) {
    const address = addresses[i];
    const n = parseInt(i) + 1; // display number for humans

    // Load account information
    let credits, creditsPerToken, isUpgraded;
    if (config.highres) {
      [credits, creditsPerToken, isUpgraded] =
        await ousd.creditsBalanceOfHighres(address);
    } else {
      [credits, creditsPerToken] = await ousd.creditsBalanceOf(address);
    }

    // Skip empty accounts
    if (credits.eq(0)) {
      console.log(n, "⭕️", address, "empty", credits.toString());
      continue;
    }

    // Math
    const balance = credits.mul(E18).div(creditsPerToken);
    const isRebasing = globalRCPT.eq(creditsPerToken);
    isUpgraded = creditsPerToken.eq(E27) || isUpgraded;
    let icon = isRebasing ? "🟠" : "🟧";
    icon = isUpgraded ? "✅" : icon;

    calcSupply = calcSupply ? calcSupply.add(balance) : balance;
    if (isRebasing) {
      calcRebasingCredits = calcRebasingCredits
        ? calcRebasingCredits.add(credits)
        : credits;
    } else {
      calcNonRebasingSupply = calcNonRebasingSupply
        ? calcNonRebasingSupply.add(balance)
        : balance;
    }

    if (!isUpgraded)
      // Save
      toUpgrade.push([
        address,
        balance.toString(),
        credits.toString(),
        creditsPerToken.toString(),
      ]);

    // Display
    console.log(
      n,
      icon,
      address,
      balance.toString(),
      credits.toString(),
      creditsPerToken.toString()
    );
  }

  // Totals
  console.log("---------");
  console.log(
    "Sum of Balances",
    calcSupply.toString(),
    "(",
    calcSupply.div(E18).toString(),
    ")"
  );
  console.log("Total RebasingCredits", calcRebasingCredits.toString());
  console.log("Total NonRebasingSupply", calcNonRebasingSupply.toString());
  console.log("---------");

  // Write output file
  if (config.upgradeFile) {
    const output = {
      addresses: toUpgrade,
      totals: {
        calcSupply: calcSupply.toString(),
        calcRebasingCredits: calcRebasingCredits.toString(),
        calcNonRebasingSupply: calcNonRebasingSupply.toString(),
      },
    };
    await fs.writeFileSync(config.upgradeFile, JSON.stringify(output));
  }
}

// Util to parse command line args.
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
  highres: args["--highres"] || false,
  addressesFile: args["--addressesFile"],
  upgradeFile: args["--upgradeFile"],
};

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
