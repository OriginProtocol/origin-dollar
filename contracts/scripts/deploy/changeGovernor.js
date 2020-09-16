// Script to change governorship of contracts.

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");

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

async function main(config) {
  const newGovernorAddress = config.newGovernorAddress;
  if (!ethers.isAddress(newGovernorAddress)) {
    throw new Error(`Invalid new governor address ${newGovernorAddress}`);
  }

  // Get all contracts to operate on.
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    vaultProxy.address
  );
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("UniswapOracle");

  // Get the address and a signer for the new governor.
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Read the current governor address on all the contracts.
  const vaultGovernorAddress = await vault.governor();
  const compoundStrategyGovernorAddress = await compoundStrategy.governor();
  const vaultMixOracleAddress = await mixOracle.governor();
  const vaultChainlinkOracleAddress = await chainlinkOracle.governor();
  const vaultUniswapOracleAddress = await uniswapOracle.governor();

  // Make sure the contracts currently have the expected governorship.
  if (vaultGovernorAddress !== governorAddr) {
    throw new Error(
      `Vault: Expected governor address ${governorAddr} but got ${vaultGovernorAddress}`
    );
  }
  if (compoundStrategyGovernorAddress !== governorAddr) {
    throw new Error(
      `CompoundStrategy: Expected governor address ${governorAddr} but got ${vaultGovernorAddress}`
    );
  }
  if (vaultMixOracleAddress !== governorAddr) {
    throw new Error(
      `MixOracle: Expected governor address ${governorAddr} but got ${vaultMixOracleAddress}`
    );
  }
  if (vaultGovernorAddress !== governorAddr) {
    throw new Error(
      `ChainlinkOracle: Expected governor address ${governorAddr} but got ${vaultChainlinkOracleAddress}`
    );
  }
  if (vaultGovernorAddress !== governorAddr) {
    throw new Error(
      `UniswapOracle: Expected governor address ${governorAddr} but got ${vaultUniswapOracleAddress}`
    );
  }

  if (args.doIt) {
    console.log(
      `Changing governorship of Vault ${vault.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    await vault.connect(sGovernor).changeGovernor(newGovernorAddress);

    console.log(
      `Changing governorship of CompoundStrategy ${compoundStrategy.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    await compoundStrategy
      .connect(sGovernor)
      .changeGovernor(newGovernorAddress);

    console.log(
      `Changing governorship of MixOracle ${mixOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    await mixOracle.connect(sGovernor).changeGovernor(newGovernorAddress);

    console.log(
      `Changing governorship of ChainlinkOracle ${chainlinkOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    await chainlinkOracle.connect(sGovernor).changeGovernor(newGovernorAddress);

    console.log(
      `Changing governorship of UniswapOracle ${uniswapOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    await uniswapOracle.connect(sGovernor).changeGovernor(newGovernorAddress);
  } else {
    // Dry-run mode.
    console.log(
      `Would change governorship of Vault ${vault.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    console.log(
      `Would change governorship of CompoundStrategy ${compoundStrategy.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    console.log(
      `Would change governorship of MixOracle ${mixOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    console.log(
      `Would change governorship of ChainlinkOracle ${chainlinkOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
    console.log(
      `Would change governorship of UniswapOracle ${uniswapOracle.address} from ${governorAddr} to ${newGovernorAddress}`
    );
  }
}

// Parse config.
const args = parseArgv();
const config = {
  // dry run mode vs for real.
  doIt: args["--doIt"] === "true" || false,
  newGovernorAddr: args["--newGovernorAddr"],
};
console.log("Config:");
console.log(config);

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
