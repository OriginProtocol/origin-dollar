const fs = require("fs");
const { chunk } = require("lodash");
const { ethers, getNamedAccounts } = require("hardhat");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

const OUSD_ADDRESS = addresses.mainnet.OUSDProxy;
const E18 = "1000000000000000000";
BATCH_SIZE = 120;

async function main(config) {
  if (!config.upgradeFile) {
    throw new Error("Must specify upgradeFile");
  }

  const filedata = fs.readFileSync(config.upgradeFile);
  const addresses = JSON.parse(filedata)["addresses"];

  const { deployerAddr } = getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const ousd = await ethers.getContractAt(
    "OUSDResolutionUpgrade",
    OUSD_ADDRESS
  );

  if (config.upgradeGlobals) {
    console.log("💠💠 Upgrading master");
    await withConfirmation(ousd.upgradeGlobals(await getTxOpts()));
    console.log("... ✅  Master upgraded");
  }

  for (const batch of chunk(addresses, BATCH_SIZE)) {
    const batchAddress = batch.map((x) => x[0]);
    console.log("---");
    batchAddress.forEach((x) => console.log("💠", x));
    console.log("Sending...");
    const tx = await withConfirmation(
      ousd.connect(sDeployer).upgradeAccounts(batchAddress, await getTxOpts())
    );
    console.log(tx);
    console.log("✅");
  }
  console.log("✅✅ Upgrade complete");
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
  upgradeFile: args["--upgradeFile"],
  upgradeGlobals: args["--upgradeGlobals"],
};

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
