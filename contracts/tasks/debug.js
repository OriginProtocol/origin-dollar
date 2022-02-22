const { utils } = require("ethers");
const { formatUnits } = utils;

const erc20Abi = require("../test/abi/erc20.json");
const addresses = require("../utils/addresses");

/**
 * Prints information about deployed contracts and their config.
 */
async function debug(taskArguments, hre) {
  //
  // Get all contracts to operate on.
  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const ousdProxy = await hre.ethers.getContract("OUSDProxy");
  const aaveProxy = await hre.ethers.getContract("AaveStrategyProxy");
  const compoundProxy = await hre.ethers.getContract("CompoundStrategyProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
  const cVault = await hre.ethers.getContract("Vault");
  const vaultAdmin = await hre.ethers.getContract("VaultAdmin");
  const vaultCore = await hre.ethers.getContract("VaultCore");
  const ousd = await hre.ethers.getContractAt("OUSD", ousdProxy.address);
  const cOusd = await hre.ethers.getContract("OUSD");
  const aaveStrategy = await hre.ethers.getContractAt(
    "AaveStrategy",
    aaveProxy.address
  );
  const cAaveStrategy = await hre.ethers.getContract("AaveStrategy");
  const compoundStrategy = await hre.ethers.getContractAt(
    "CompoundStrategy",
    compoundProxy.address
  );
  const cCompoundStrategy = await hre.ethers.getContract("CompoundStrategy");
  const threePoolStrategyProxy = await hre.ethers.getContract(
    "ConvexStrategyProxy"
  );
  const threePoolStrategy = await hre.ethers.getContractAt(
    "ConvexStrategy",
    threePoolStrategyProxy.address
  );
  const cThreePoolStrategy = await hre.ethers.getContract("ConvexStrategy");

  const oracleRouter = await hre.ethers.getContract("OracleRouter");

  const governor = await hre.ethers.getContract("Governor");

  const ognStakingProxy = await hre.ethers.getContract("OGNStakingProxy");
  const ognStaking = await hre.ethers.getContract("SingleAssetStaking");

  const cBuyback = await hre.ethers.getContract("Buyback");

  //
  // Addresses
  //
  console.log("\nContract addresses");
  console.log("====================");
  console.log(`OUSD proxy:              ${ousdProxy.address}`);
  console.log(`OUSD impl:               ${await ousdProxy.implementation()}`);
  console.log(`OUSD:                    ${cOusd.address}`);
  console.log(`Vault proxy:             ${vaultProxy.address}`);
  console.log(`Vault impl:              ${await vaultProxy.implementation()}`);
  console.log(`Vault:                   ${cVault.address}`);
  console.log(`VaultCore:               ${vaultCore.address}`);
  console.log(`VaultAdmin:              ${vaultAdmin.address}`);
  console.log(`OracleRouter:            ${oracleRouter.address}`);
  console.log(`AaveStrategy proxy:      ${aaveProxy.address}`);
  console.log(`AaveStrategy impl:       ${await aaveProxy.implementation()}`);
  console.log(`AaveStrategy:            ${cAaveStrategy.address}`);
  console.log(`CompoundStrategy proxy:  ${compoundProxy.address}`);
  console.log(
    `CompoundStrategy impl:   ${await compoundProxy.implementation()}`
  );
  console.log(`CompoundStrategy:        ${cCompoundStrategy.address}`);
  console.log(`ThreePoolStrategy proxy: ${threePoolStrategyProxy.address}`);
  console.log(
    `ThreePoolStrategy impl:  ${await threePoolStrategyProxy.implementation()}`
  );
  console.log(`ThreePoolStrategy:       ${cThreePoolStrategy.address}`);
  console.log(`Governor:                ${governor.address}`);
  console.log(`Buyback:                 ${cBuyback.address}`);
  console.log(`OGNStaking proxy:        ${ognStakingProxy.address}`);
  console.log(
    `OGNStaking proxy impl:   ${await ognStakingProxy.implementation()}`
  );
  console.log(`OGNStaking:              ${ognStaking.address}`);

  //
  // Governor
  //
  const govAdmin = await governor.admin();
  const govPendingAdmin = await governor.pendingAdmin();
  const govDelay = await governor.delay();
  const govPropCount = await governor.proposalCount();
  console.log("\nGovernor");
  console.log("====================");
  console.log("Admin:           ", govAdmin);
  console.log("PendingAdmin:    ", govPendingAdmin);
  console.log("Delay (seconds): ", govDelay.toString());
  console.log("ProposalCount:   ", govPropCount.toString());

  //
  // Governance
  //

  // Read the current governor address on all the contracts.
  const ousdGovernorAddr = await ousd.governor();
  const vaultGovernorAddr = await vault.governor();
  const aaveStrategyGovernorAddr = await aaveStrategy.governor();
  const compoundStrategyGovernorAddr = await compoundStrategy.governor();
  const threePoolStrategyGovernorAddr = await threePoolStrategy.governor();

  console.log("\nGovernor addresses");
  console.log("====================");
  console.log("OUSD:              ", ousdGovernorAddr);
  console.log("Vault:             ", vaultGovernorAddr);
  console.log("AaveStrategy:      ", aaveStrategyGovernorAddr);
  console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
  console.log("ThreePoolStrategy: ", threePoolStrategyGovernorAddr);

  //
  // OUSD
  //
  const name = await ousd.name();
  const decimals = await ousd.decimals();
  const symbol = await ousd.symbol();
  const totalSupply = await ousd.totalSupply();
  const vaultAddress = await ousd.vaultAddress();
  const nonRebasingSupply = await ousd.nonRebasingSupply();
  const rebasingSupply = totalSupply.sub(nonRebasingSupply);
  const rebasingCreditsPerToken = await ousd.rebasingCreditsPerToken();
  const rebasingCredits = await ousd.rebasingCredits();

  console.log("\nOUSD");
  console.log("=======");
  console.log(`name:                    ${name}`);
  console.log(`symbol:                  ${symbol}`);
  console.log(`decimals:                ${decimals}`);
  console.log(`totalSupply:             ${formatUnits(totalSupply, 18)}`);
  console.log(`vaultAddress:            ${vaultAddress}`);
  console.log(`nonRebasingSupply:       ${formatUnits(nonRebasingSupply, 18)}`);
  console.log(`rebasingSupply:          ${formatUnits(rebasingSupply, 18)}`);
  console.log(`rebasingCreditsPerToken: ${rebasingCreditsPerToken}`);
  console.log(`rebasingCredits:         ${rebasingCredits}`);

  //
  // Oracle
  //
  console.log("\nOracle");
  console.log("========");
  const priceDAI = await oracleRouter.price(addresses.mainnet.DAI);
  const priceUSDC = await oracleRouter.price(addresses.mainnet.USDC);
  const priceUSDT = await oracleRouter.price(addresses.mainnet.USDT);
  console.log(`DAI price :  ${formatUnits(priceDAI, 8)} USD`);
  console.log(`USDC price:  ${formatUnits(priceUSDC, 8)} USD`);
  console.log(`USDT price:  ${formatUnits(priceUSDT, 8)} USD`);

  //
  // Vault
  //
  const rebasePaused = await vault.rebasePaused();
  const capitalPaused = await vault.capitalPaused();
  const redeemFeeBps = Number(await vault.redeemFeeBps());
  const trusteeFeeBps = Number(await vault.trusteeFeeBps());
  const vaultBuffer = Number(
    formatUnits((await vault.vaultBuffer()).toString(), 18)
  );
  const autoAllocateThreshold = await vault.autoAllocateThreshold();
  const rebaseThreshold = await vault.rebaseThreshold();
  const maxSupplyDiff = await vault.maxSupplyDiff();
  const strategyCount = await vault.getStrategyCount();
  const assetCount = await vault.getAssetCount();
  const strategistAddress = await vault.strategistAddr();
  const trusteeAddress = await vault.trusteeAddress();
  const priceProvider = await vault.priceProvider();

  console.log("\nVault Settings");
  console.log("================");
  console.log("rebasePaused:\t\t\t", rebasePaused);
  console.log("capitalPaused:\t\t\t", capitalPaused);
  console.log(`redeemFeeBps:\t\t\t ${redeemFeeBps} (${redeemFeeBps / 100}%)`);
  console.log(
    `trusteeFeeBps:\t\t\t ${trusteeFeeBps} (${trusteeFeeBps / 100}%)`
  );
  console.log(`vaultBuffer:\t\t\t ${vaultBuffer} (${vaultBuffer * 100}%)`);
  console.log(
    "autoAllocateThreshold (USD):\t",
    formatUnits(autoAllocateThreshold.toString(), 18)
  );
  console.log(
    "rebaseThreshold (USD):\t\t",
    formatUnits(rebaseThreshold.toString(), 18)
  );

  console.log(
    `maxSupplyDiff:\t\t\t ${formatUnits(maxSupplyDiff.toString(), 16)}%`
  );

  console.log("Price provider address:\t\t", priceProvider);
  console.log("Strategy count:\t\t\t", Number(strategyCount));
  console.log("Asset count:\t\t\t", Number(assetCount));
  console.log("Strategist address:\t\t", strategistAddress);
  console.log("Trustee address:\t\t", trusteeAddress);

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

  const totalValue = await vault.totalValue();
  const balances = {};
  for (const asset of assets) {
    const balance = await vault["checkBalance(address)"](asset.address);
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
      (await (
        await hre.ethers.getContractAt(erc20Abi, asset.address)
      ).balanceOf(vault.address)) /
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
  let asset = assets[0]; // Aave only holds DAI
  let balanceRaw = await aaveStrategy.checkBalance(asset.address);
  let balance = formatUnits(balanceRaw.toString(), asset.decimals);
  console.log(`Aave ${asset.symbol}:\t balance=${balance}`);

  //
  // Compound Strategy
  //
  let compoundsAssets = [assets[0], assets[1], assets[2]]; // Compound only holds USDC and USDT
  for (asset of compoundsAssets) {
    balanceRaw = await compoundStrategy.checkBalance(asset.address);
    balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`Compound ${asset.symbol}:\t balance=${balance}`);
  }

  //
  // ThreePool Strategy
  // Supports all stablecoins
  //
  for (asset of assets) {
    balanceRaw = await threePoolStrategy.checkBalance(asset.address);
    balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`ThreePool ${asset.symbol}:\t balance=${balance}`);
  }

  //
  // Strategies settings
  //

  console.log("\nDefault strategies");
  console.log("============================");
  for (const asset of assets) {
    console.log(
      asset.symbol,
      `\t${await vault.assetDefaultStrategies(asset.address)}`
    );
  }

  console.log("\nAave strategy settings");
  console.log("============================");
  console.log("vaultAddress:\t\t\t", await aaveStrategy.vaultAddress());
  console.log("platformAddress:\t\t", await aaveStrategy.platformAddress());
  console.log(
    "rewardTokenAddress:\t\t",
    await aaveStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold:\t",
    (await aaveStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t\t`,
      await aaveStrategy.supportsAsset(asset.address)
    );
  }

  console.log("\nCompound strategy settings");
  console.log("============================");
  console.log("vaultAddress:\t\t\t", await compoundStrategy.vaultAddress());
  console.log("platformAddress:\t\t", await compoundStrategy.platformAddress());
  console.log(
    "rewardTokenAddress:\t\t",
    await compoundStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold:\t",
    (await compoundStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t\t`,
      await compoundStrategy.supportsAsset(asset.address)
    );
  }

  console.log("\n3pool strategy settings");
  console.log("==============================");
  console.log("vaultAddress:\t\t\t", await threePoolStrategy.vaultAddress());
  console.log(
    "platformAddress:\t\t",
    await threePoolStrategy.platformAddress()
  );
  console.log(
    "rewardTokenAddress:\t\t",
    await threePoolStrategy.rewardTokenAddress()
  );
  console.log(
    "cvxRewardTokenAddress:\t\t",
    await threePoolStrategy.cvxRewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold:\t",
    (await threePoolStrategy.rewardLiquidationThreshold()).toString()
  );

  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t\t`,
      await threePoolStrategy.supportsAsset(asset.address)
    );
  }
}

module.exports = {
  debug,
};
