// Script to check contracts have been properly deployed and configured.
//
// Usage:
//  - Setup your environment:
//      export BUIDLER_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//  - Then run:
//      node checkDeploy.js

const { ethers } = require("@nomiclabs/buidler");
const { utils } = require("ethers");
const { formatUnits } = utils;
const addresses = require("../../utils/addresses");

async function main() {
  const testAccountAddr = "0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD";
  const signer = await ethers.provider.getSigner(testAccountAddr);

  //
  // Contract addresses.

  //
  // Get all contracts to operate on.
  const vaultProxy = await ethers.getContract("VaultProxy");
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const compoundProxy = await ethers.getContract("CompoundStrategyProxy");
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const cVault = await ethers.getContract("Vault");
  const viewVault = await ethers.getContractAt(
    "IViewVault",
    vaultProxy.address
  );
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const cOusd = await ethers.getContract("OUSD");
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundProxy.address
  );
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  console.log("\nContract addresses");
  console.log("====================");
  console.log(`OUSD proxy:        ${ousdProxy.address}`);
  console.log(`OUSD contract      ${cOusd.address}`);
  console.log(`Vault proxy:       ${vaultProxy.address}`);
  console.log(`Vault contract     ${cVault.address}`);
  console.log(`CompoundStrategy:  ${compoundStrategy.address}`);
  console.log(`MixOracle:         ${mixOracle.address}`);
  console.log(`ChainlinkOracle:   ${chainlinkOracle.address}`);
  console.log(`OpenUniswapOracle: ${uniswapOracle.address}`);

  //
  // Governors
  //

  // Read the current governor address on all the contracts.
  const ousdGovernorAddr = await ousd.governor();
  const vaultGovernorAddr = await vault.governor();
  const compoundStrategyGovernorAddr = await compoundStrategy.governor();
  const mixOracleGovernorAddr = await mixOracle.governor();
  const chainlinkOracleGovernoreAddr = await chainlinkOracle.governor();
  const openUniswapOracleGovernorAddr = await uniswapOracle.governor();

  console.log("\nCurrent governor addresses");
  console.log("============================");
  console.log("OUSD:              ", ousdGovernorAddr);
  console.log("Vault:             ", vaultGovernorAddr);
  console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
  console.log("MixOracle:         ", mixOracleGovernorAddr);
  console.log("ChainlinkOracle:   ", chainlinkOracleGovernoreAddr);
  console.log("OpenUniswapOracle: ", openUniswapOracleGovernorAddr);

  //
  // OUSD
  //
  const decimals = await ousd.decimals();
  const symbol = await ousd.symbol();
  const totalSupply = await ousd.totalSupply();
  const vaultAddress = await ousd.vaultAddress();

  console.log("\nOUSD");
  console.log("=======");
  console.log(`symbol:       ${symbol}`);
  console.log(`decimals:     ${decimals}`);
  console.log(`totalSupply:  ${formatUnits(totalSupply, 18)}`);
  console.log(`vaultAddress: ${vaultAddress}`);

  //
  // Vault
  //
  const rebasePaused = await vault.rebasePaused();
  const depositPaused = await vault.depositPaused();
  const redeemFeeBps = await vault.redeemFeeBps();
  const vaultBuffer = await vault.vaultBuffer();
  const autoAllocateThreshold = await vault.autoAllocateThreshold();
  const rebaseThreshold = await vault.rebaseThreshold();

  console.log("\nVault Settings");
  console.log("================");
  console.log("rebasePaused:                ", rebasePaused);
  console.log("depositPaused:               ", depositPaused);
  console.log("redeemFeeBps:                ", redeemFeeBps.toString());
  console.log(
    "vaultBuffer:                 ",
    formatUnits(vaultBuffer.toString(), 18)
  );
  console.log(
    "autoAllocateThreshold (USD): ",
    formatUnits(autoAllocateThreshold.toString(), 18)
  );
  console.log(
    "rebaseThreshold (USD): ",
    formatUnits(rebaseThreshold.toString(), 18)
  );

  const assets = [
    {
      symbol: "DAI",
      address: addresses.mainnet.DAI,
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: addresses.mainnet.USDC,
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: addresses.mainnet.USDT,
      decimals: 6,
    },
  ];

  const totalValue = await viewVault.totalValue();
  const balances = {};
  for (const asset of assets) {
    // Note: clarify why a signer is required to query checkBalance() despite no transaction being sent?
    const balance = await vault.connect(signer).checkBalance(asset.address);
    balances[asset.symbol] = formatUnits(balance.toString(), asset.decimals);
  }
  const vaultApr = await viewVault.getAPR();

  console.log("\nVault APR and balances");
  console.log("================");
  console.log("vault APR:       ", formatUnits(vaultApr.toString(), 18));
  console.log("totalValue (USD):", formatUnits(totalValue.toString(), 18));
  for (const [symbol, balance] of Object.entries(balances)) {
    console.log(`  ${symbol}\t: ${balance}`);
  }

  //
  // Compound strategy
  //
  const apr = await compoundStrategy.getAPR();
  const aprs = {};
  for (const asset of assets) {
    const apr = await compoundStrategy.getAssetAPR(asset.address);
    aprs[asset.symbol] = formatUnits(apr.toString(), 18);
  }

  console.log("\nCompound strategy");
  console.log("================");
  console.log("APR:", formatUnits(apr.toString(), 18));
  for (const [symbol, apr] of Object.entries(aprs)) {
    console.log(`  ${symbol}\t: ${apr}`);
  }

  //
  // MixOracle
  //

  // TODO

  //
  // ChainlinkOracle
  //

  // TODO

  //
  // OpenUniswapOracle
  //

  // TODO
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
  // dry run mode vs for real.
  verbose: args["--verbose"] === "true" || false,
};
console.log("Config:");
console.log(config);

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
