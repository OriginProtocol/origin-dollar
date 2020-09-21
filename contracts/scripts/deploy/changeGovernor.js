// Script to change ownership of contracts:
//  - OUSD proxy and Vault proxy: changes admin address
//  - Vault, Strategy, Oracles contracts: changes governor address
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export PROVIDER_URL=<url>
//  - Dry-run mode:
//      node changeOwnership.js --newAddr=<addr>
//  - Run for real:
//      node changeOwnership.js --newAddr=<addr> --doIt=true

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

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

async function updateGovernor(contract, currentGovernorAddr, newGovernorAddr, doIt) {
  const signerCurrentGovernor = await ethers.provider.getSigner(currentGovernorAddr);
  const signerNewGovernor = await ethers.provider.getSigner(newGovernorAddr);

  console.log(`${contract.name}`);
  if (!doIt) {
    console.log(`WOuld change governor from ${currentGovernorAddr} to ${newGovernorAddr}`);
    return
  }

  let tx = await contract
    .connect(signerCurrentGovernor)
    .transferGovernance(newGovernorAddr, await getTxOpts());
  console.log("transferGovernance tx sent.");

  await ethers.provider.waitForTransaction(tx.hash, NUM_CONFIRMATIONS);
  console.log("transferGovernance tx confirmed.");

  tx = await contract
    .connect(signerNewGovernor)
    .claimGovernance(await getTxOpts());
  await ethers.provider.waitForTransaction(tx.hash, NUM_CONFIRMATIONS);
  console.log("claimGovernance tx confirmed.");
}

async function main(config) {
  const newGovernorAddr = config.newGovernorAddr;
  if (!utils.isAddress(newGovernorAddr)) {
    throw new Error(`Invalid new governor address ${newGovernorAddr}`);
  }

  const { governorAddr } = await getNamedAccounts();
  console.log("\nAccounts:");
  console.log("===========");
  console.log(`Governor   : ${governorAddr}`);

  // Get all contracts to operate on.
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");
  const compoundStrategyProxy = await ethers.getContract("CompoundStrategyProxy");
  const vault = await ethers.getContractAt("Vault", vaultProxy.address)
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address)
  const compoundStrategy = await ethers.getContractAt("CompoundStrategy", compoundStrategyProxy.address)
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  const contracts = [
    { name: "OUSD", contract: ousd },
    { name: "Vault", contract: vault },
    { name: "CompoundStrategy", contract: compoundStrategy },
    { name: "MixOracle", contract: mixOracle },
    { name: "ChainlinkOracle", contract: chainlinkOracle },
    { name: "OpenUniswapOracle", contract: uniswapOracle }
  ]

  console.log("\nContract addresses:");
  console.log("=====================");
  for (const contract of contracts) {
    console.log(`${contract.name}:\t${contract.address}`)
  }

  // Read the current governor address on all the contracts.
  // and make they have the expected governor.
  console.log("\nCurrent governor addresses:");
  console.log("============================");
  let errors = []
  for (const contract of contracts) {
    const contractGovernorAddr = await contract.governor();
    console.log(`${contract.name}:\t${contractGovernorAddr}`);
    if (contractGovernorAddr !== governorAddr) {
      errors.push(`${contract.name} expected governor ${governorAddr} but got ${contractGovernorAddr}`)
    }
  }
  if(errors.length > 0) {
    console.log("Error:", errors);
  }

  // Change governor on each contract.
  for (const contract of contracts) {
    await updateGovernor(contract, governorAddr, newGovernorAddr, config.doIt);
  }
  console.log("Done");
}

// Parse config.
const args = parseArgv();
const config = {
  // dry run mode vs for real.
  doIt: args["--doIt"] === "true" || false,
  newAddr: args["--newGovernorAddr"],
};
console.log("Config:");
console.log(config);

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
