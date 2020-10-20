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
const ERC20Abi = require("../../test/abi/erc20.json");

async function main() {
  const testAccountAddr = "0x17BAd8cbCDeC350958dF0Bfe01E284dd8Fec3fcD";
  const signer = await ethers.provider.getSigner(testAccountAddr);

  //
  // Contract addresses.

  //
  // Get all contracts to operate on.
  const vaultProxy = await ethers.getContract("VaultProxy");
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const aaveProxy = await ethers.getContract("AaveStrategyProxy");
  const compoundProxy = await ethers.getContract("CompoundStrategyProxy");
  const curveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const curveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
  const cVault = await ethers.getContract("Vault");
  const viewVault = await ethers.getContractAt(
    "IViewVault",
    vaultProxy.address
  );
  const vaultAdmin = await ethers.getContract("VaultAdmin");
  const vaultCore = await ethers.getContract("VaultCore");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const cOusd = await ethers.getContract("OUSD");
  const aaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    aaveProxy.address
  );
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundProxy.address
  );
  const curveUsdcStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDCStrategyProxy.address
  );
  const curveUsdtStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDTStrategyProxy.address
  );
  const cAaveStrategy = await ethers.getContract("AaveStrategy");
  const cCompoundStrategy = await ethers.getContract("CompoundStrategy");
  const cCurveUSDCStrategy = await ethers.getContract("CurveUSDCStrategy");
  const cCurveUSDTStrategy = await ethers.getContract("CurveUSDTStrategy");

  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  const minuteTimelock = await ethers.getContract("MinuteTimelock");
  const rebaseHooks = await ethers.getContract("RebaseHooks");
  const governor = await ethers.getContract("Governor");

  console.log("\nContract addresses");
  console.log("====================");
  console.log(`OUSD proxy:              ${ousdProxy.address}`);
  console.log(`OUSD:                    ${cOusd.address}`);
  console.log(`Vault proxy:             ${vaultProxy.address}`);
  console.log(`Vault:                   ${cVault.address}`);
  console.log(`Vault core:              ${vaultCore.address}`);
  console.log(`Vault admin:             ${vaultAdmin.address}`);
  console.log(`AaveStrategy proxy:      ${aaveProxy.address}`);
  console.log(`AaveStrategy:            ${cAaveStrategy.address}`);
  console.log(`CompoundStrategy proxy:  ${compoundProxy.address}`);
  console.log(`CompoundStrategy:        ${cCompoundStrategy.address}`);
  console.log(`CurveUSDCStrategy proxy: ${curveUSDCStrategyProxy.address}`);
  console.log(`CurveUSDCStrategy:       ${cCurveUSDCStrategy.address}`);
  console.log(`CurveUSDTStrategy proxy: ${curveUSDTStrategyProxy.address}`);
  console.log(`CurveUSDTStrategy:       ${cCurveUSDTStrategy.address}`);
  console.log(`MixOracle:               ${mixOracle.address}`);
  console.log(`ChainlinkOracle:         ${chainlinkOracle.address}`);
  console.log(`OpenUniswapOracle:       ${uniswapOracle.address}`);
  console.log(`MinuteTimelock:          ${minuteTimelock.address}`);
  console.log(`RebaseHooks:             ${rebaseHooks.address}`);
  console.log(`Governor:                ${governor.address}`);

  //
  // Governors
  //

  // Read the current governor address on all the contracts.
  const ousdGovernorAddr = await ousd.governor();
  const vaultGovernorAddr = await vault.governor();
  const aaveStrategyGovernorAddr = await aaveStrategy.governor();
  const compoundStrategyGovernorAddr = await compoundStrategy.governor();
  const curveUsdcStrategyGovernorAddr = await curveUsdcStrategy.governor();
  const curveUsdtStrategyGovernorAddr = await curveUsdtStrategy.governor();
  const mixOracleGovernorAddr = await mixOracle.governor();
  const chainlinkOracleGovernoreAddr = await chainlinkOracle.governor();
  const openUniswapOracleGovernorAddr = await uniswapOracle.governor();
  const rebaseHooksOracleGovernorAddr = await rebaseHooks.governor();

  console.log("\nGovernor addresses");
  console.log("====================");
  console.log("OUSD:              ", ousdGovernorAddr);
  console.log("Vault:             ", vaultGovernorAddr);
  console.log("AaveStrategy:      ", aaveStrategyGovernorAddr);
  console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
  console.log("CurveUSDCStrategy: ", curveUsdcStrategyGovernorAddr);
  console.log("CurveUSDTStrategy: ", curveUsdtStrategyGovernorAddr);
  console.log("MixOracle:         ", mixOracleGovernorAddr);
  console.log("ChainlinkOracle:   ", chainlinkOracleGovernoreAddr);
  console.log("OpenUniswapOracle: ", openUniswapOracleGovernorAddr);
  console.log("RebaseHooks        ", rebaseHooksOracleGovernorAddr);

  console.log("\nAdmin addresses");
  console.log("=================");
  const minuteTimeLockGovernorAddr = await minuteTimelock.admin();
  console.log("MinuteTimelock:    ", minuteTimeLockGovernorAddr);

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
  const rebaseHooksUniswapPairs = await rebaseHooks.uniswapPairs(0);
  const uniswapAddr = await vault.uniswapAddr();
  const strategyCount = await vault.getStrategyCount();
  const assetCount = await vault.getAssetCount();

  console.log("\nVault Settings");
  console.log("================");
  console.log("rebasePaused:\t\t\t", rebasePaused);
  console.log("depositPaused:\t\t\t", depositPaused);
  console.log("redeemFeeBps:\t\t\t", redeemFeeBps.toString());
  console.log("vaultBuffer:\t\t\t", formatUnits(vaultBuffer.toString(), 18));
  console.log(
    "autoAllocateThreshold (USD):\t",
    formatUnits(autoAllocateThreshold.toString(), 18)
  );
  console.log(
    "rebaseThreshold (USD):\t\t",
    formatUnits(rebaseThreshold.toString(), 18)
  );
  console.log("Rebase hooks pairs:\t\t", rebaseHooksUniswapPairs);
  console.log("Uniswap address:\t\t", uniswapAddr);
  console.log("Strategy count:\t\t\t", Number(strategyCount));
  console.log("Asset count:\t\t\t", Number(assetCount));

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
    const balance = await vault
      .connect(signer)
      ["checkBalance(address)"](asset.address);
    balances[asset.symbol] = formatUnits(balance.toString(), asset.decimals);
  }

  console.log("\nVault balances");
  console.log("================");
  console.log(
    `totalValue (USD):\t $${Number(
      formatUnits(totalValue.toString(), 18)
    ).toFixed(2)}`
  );
  for (const [symbol, balance] of Object.entries(balances)) {
    console.log(`  ${symbol}:\t\t\t ${Number(balance).toFixed(2)}`);
  }

  console.log("\nVault buffer balances");
  console.log("================");

  const vaultBufferBalances = {};
  for (const asset of assets) {
    vaultBufferBalances[asset.symbol] =
      (await (await ethers.getContractAt(ERC20Abi, asset.address)).balanceOf(
        vault.address
      )) /
      (1 * 10 ** asset.decimals);
  }
  for (const [symbol, balance] of Object.entries(vaultBufferBalances)) {
    console.log(`${symbol}:\t\t\t ${balance}`);
  }

  console.log("\nStrategies balances");
  console.log("=====================");
  //
  // Aave Strategy
  //
  let asset = assets[0]; // Compound only holds DAI
  let balanceRaw = await aaveStrategy.checkBalance(asset.address);
  let balance = formatUnits(balanceRaw.toString(), asset.decimals);
  console.log(`Aave ${asset.symbol}:\t balance=${balance}`);

  //
  // Compound Strategy
  //
  asset = assets[0]; // Compound only holds DAI
  balanceRaw = await compoundStrategy.checkBalance(asset.address);
  balance = formatUnits(balanceRaw.toString(), asset.decimals);
  console.log(`Compound ${asset.symbol}:\t balance=${balance}`);

  //
  // ThreePool USDC Strategy
  //
  asset = assets[1];
  balanceRaw = await curveUsdcStrategy.checkBalance(asset.address);
  balance = formatUnits(balanceRaw.toString(), asset.decimals);
  console.log(`ThreePool ${asset.symbol}:\t balance=${balance}`);

  //
  // ThreePool USDT Strategy
  //
  asset = assets[2];
  balanceRaw = await curveUsdtStrategy.checkBalance(asset.address);
  balance = formatUnits(balanceRaw.toString(), asset.decimals);
  console.log(`ThreePool ${asset.symbol}:\t balance=${balance}`);


  //
  // Strategies settings
  //
  console.log("\nAave strategy settings");
  console.log("============================");
  console.log(
    "vaultAddress:               ",
    await aaveStrategy.vaultAddress()
  );
  console.log(
    "platformAddress:            ",
    await aaveStrategy.platformAddress()
  );
  console.log(
    "rewardTokenAddress:         ",
    await aaveStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold: ",
    (await aaveStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t`,
      await aaveStrategy.supportsAsset(asset.address)
    );
  }

  console.log("\nCompound strategy settings");
  console.log("============================");
  console.log(
    "vaultAddress:               ",
    await compoundStrategy.vaultAddress()
  );
  console.log(
    "platformAddress:            ",
    await compoundStrategy.platformAddress()
  );
  console.log(
    "rewardTokenAddress:         ",
    await compoundStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold: ",
    (await compoundStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t`,
      await compoundStrategy.supportsAsset(asset.address)
    );
  }

  console.log("\nCurve USDC strategy settings");
  console.log("==============================");
  console.log(
    "vaultAddress:               ",
    await curveUsdcStrategy.vaultAddress()
  );
  console.log(
    "platformAddress:            ",
    await curveUsdcStrategy.platformAddress()
  );
  console.log(
    "rewardTokenAddress:         ",
    await curveUsdcStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold: ",
    (await curveUsdcStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t`,
      await curveUsdcStrategy.supportsAsset(asset.address)
    );
  }

  console.log("\nCurve USDT strategy settings");
  console.log("==============================");
  console.log(
    "vaultAddress:               ",
    await curveUsdtStrategy.vaultAddress()
  );
  console.log(
    "platformAddress:            ",
    await curveUsdtStrategy.platformAddress()
  );
  console.log(
    "rewardTokenAddress:         ",
    await curveUsdtStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold: ",
    (await curveUsdtStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t`,
      await curveUsdtStrategy.supportsAsset(asset.address)
    );
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
