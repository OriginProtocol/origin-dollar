const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { resolveAsset } = require("../utils/assets");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");
const { ethereumAddress } = require("../utils/regex");

const log = require("../utils/logger")("task:vault");

async function getContract(hre, symbol) {
  const contractPrefix = symbol === "OUSD" ? "" : symbol;
  const vaultProxy = await hre.ethers.getContract(
    `${contractPrefix}VaultProxy`
  );
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
  log(`Resolved ${symbol} Vault to address ${vault.address}`);

  const oTokenProxy = await ethers.getContract(`${symbol}Proxy`);
  const oToken = await ethers.getContractAt(symbol, oTokenProxy.address);
  log(`Resolved ${symbol} OToken to address ${oToken.address}`);

  return {
    vault,
    oToken,
  };
}

async function allocate(taskArguments, hre) {
  const symbol = taskArguments.symbol;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  log(
    `About to send a transaction to call allocate() on the ${symbol} vault with address ${vault.address}`
  );
  const tx = await vault.connect(signer).allocate();
  await logTxDetails(tx, "allocate");
}

async function rebase(taskArguments, hre) {
  const symbol = taskArguments.symbol;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  log(
    `About to send a transaction to call rebase() on the ${symbol} vault with address ${vault.address}`
  );
  const tx = await vault.connect(signer).rebase();
  await logTxDetails(tx, "harvest");
}

/**
 * Artificially generate yield on the vault by sending it USDT.
 */
async function yieldTask(taskArguments, hre) {
  const usdtAbi = require("../test/abi/usdt.json").abi;
  const {
    ousdUnitsFormat,
    usdtUnits,
    usdtUnitsFormat,
    isFork,
    isLocalhost,
  } = require("../test/helpers");
  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  let richSigner, usdt;
  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    richSigner = await hre.ethers.provider.getSigner(addresses.mainnet.Binance);
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  } else {
    const signers = await hre.ethers.getSigners();
    richSigner = signers;
    usdt = await hre.ethers.getContract("MockUSDT");
  }

  const { vault, oToken } = await getContract(hre, "OUSD");

  log("Sending yield to vault");
  let usdtBalance = await usdt.balanceOf(vault.address);
  log("USDT vault balance", usdtUnitsFormat(usdtBalance));
  let vaultValue = await vault.totalValue();
  log("Vault value", ousdUnitsFormat(vaultValue));
  let supply = await oToken.totalSupply();
  log("OUSD supply", ousdUnitsFormat(supply));

  // Transfer 100k USDT to the vault.
  await usdt.connect(richSigner).transfer(vault.address, usdtUnits("100000"));

  usdtBalance = await usdt.balanceOf(vault.address);
  log("USDT vault balance", usdtUnitsFormat(usdtBalance));
  vaultValue = await vault.totalValue();
  log("Vault value", ousdUnitsFormat(vaultValue));
  supply = await oToken.totalSupply();
  log("OUSD supply", ousdUnitsFormat(supply));
}

/**
 * Call the Vault's admin pauseCapital method.
 */
async function capital(taskArguments, hre) {
  const symbol = taskArguments.symbol;
  const { isMainnet } = require("../test/helpers");
  const { proposeArgs } = require("../utils/governor");

  const pause = taskArguments.pause;
  log("Setting Vault capitalPause to", pause);

  const sGovernor = await getSigner();

  const { vault } = await getContract(hre, symbol);

  if (isMainnet) {
    const signature = pause ? "pauseCapital()" : "unpauseCapital()";
    const propArgs = await proposeArgs([{ contract: vault, signature }]);

    // On Mainnet this has to be handled manually via a multi-sig tx.
    log("propose, enqueue and execute a governance proposal.");
    log(`Proposal [targets, values, sigs, datas]:`);
    log(JSON.stringify(propArgs, null, 2));
  } else {
    if (pause) {
      const tx = await vault.connect(sGovernor).pauseCapital();
      await logTxDetails(tx, "pauseCapital");
    } else {
      const tx = await vault.connect(sGovernor).unpauseCapital();
      await logTxDetails(tx, "unpauseCapital");
    }
  }
}

async function mint(taskArguments, hre) {
  const { amount, asset, symbol, min } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const cAsset = await resolveAsset(asset);
  const assetUnits = parseUnits(amount.toString(), await cAsset.decimals());
  const minUnits = parseUnits(min.toString());

  await cAsset.connect(signer).approve(vault.address, assetUnits);

  log(`About to mint ${symbol} using ${amount} ${asset}`);
  const tx = await vault
    .connect(signer)
    .mint(cAsset.address, assetUnits, minUnits);
  await logTxDetails(tx, "mint");
}

async function redeem(taskArguments, hre) {
  const { amount, min, symbol } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const oTokenUnits = parseUnits(amount.toString());
  const minUnits = parseUnits(min.toString());

  log(`About to redeem ${amount} ${symbol}`);
  const tx = await vault.connect(signer).redeem(oTokenUnits, minUnits);
  await logTxDetails(tx, "redeem");
}

async function redeemAll(taskArguments, hre) {
  const { min, symbol } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const minUnits = parseUnits(min.toString());

  log(`About to redeem all ${symbol} tokens`);
  const tx = await vault.connect(signer).redeemAll(minUnits);
  await logTxDetails(tx, "redeemAll");
}

async function resolveStrategyAddress(strategy, hre) {
  let strategyAddr = strategy;
  if (!strategy.match(ethereumAddress)) {
    const strategyContract = await hre.ethers.getContract(strategy);
    if (!strategyContract?.address) {
      throw Error(`Invalid strategy address or contract name: ${strategy}`);
    }
    strategyAddr = strategyContract.address;
  }
  log(`Resolve ${strategy} strategy to address: ${strategyAddr}`);

  return strategyAddr;
}

async function resolveAssets(assets) {
  if (!assets) {
    throw Error(
      `Invalid assets list: ${assets}. Must be a comma separated list of token symbols. eg DAI,USDT,USDC or WETH`
    );
  }
  const assetsSymbols = assets.split(",");
  const assetContracts = await Promise.all(
    assetsSymbols.map(async (symbol) => resolveAsset(symbol))
  );
  const assetAddresses = assetContracts.map((contract) => contract.address);

  log(`${assetAddresses.length} addresses: ${assetAddresses}`);

  return { assetAddresses, assetContracts };
}

async function resolveAmounts(amounts, assetContracts) {
  if (!amounts) {
    throw Error(
      `Invalid amounts list: ${amounts}. Must be a comma separated list of floating points numbers`
    );
  }
  const amountsArr = amounts.split(",");
  const amountUnits = await Promise.all(
    amountsArr.map(async (amount, i) =>
      parseUnits(amount, await assetContracts[i].decimals())
    )
  );
  log(`${amountUnits.length} amounts: ${amountUnits}`);

  return amountUnits;
}

async function depositToStrategy(taskArguments, hre) {
  const { amounts, assets, symbol, strategy } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const strategyAddr = await resolveStrategyAddress(strategy, hre);

  const { assetAddresses, assetContracts } = await resolveAssets(assets);

  const amountUnits = await resolveAmounts(amounts, assetContracts);

  log(
    `About to deposit to the ${strategy} strategy, amounts ${amounts} for assets ${assets}`
  );
  const tx = await vault
    .connect(signer)
    .depositToStrategy(strategyAddr, assetAddresses, amountUnits);
  await logTxDetails(tx, "depositToStrategy");
}

async function withdrawFromStrategy(taskArguments, hre) {
  const { amounts, assets, symbol, strategy } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const strategyAddr = await resolveStrategyAddress(strategy, hre);

  const { assetAddresses, assetContracts } = await resolveAssets(assets);

  const amountUnits = await resolveAmounts(amounts, assetContracts);

  log(
    `About to withdraw from the ${strategy} strategy, amounts ${amounts} for assets ${assets}`
  );
  const tx = await vault
    .connect(signer)
    .withdrawFromStrategy(strategyAddr, assetAddresses, amountUnits);
  await logTxDetails(tx, "withdrawFromStrategy");
}

async function withdrawAllFromStrategy(taskArguments, hre) {
  const { symbol, strategy } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  const strategyAddr = await resolveStrategyAddress(strategy, hre);

  log(`About to withdraw all from the ${strategy} strategy`);
  const tx = await vault.connect(signer).withdrawAllFromStrategy(strategyAddr);
  await logTxDetails(tx, "withdrawAllFromStrategy");
}

async function withdrawAllFromStrategies(taskArguments, hre) {
  const { symbol } = taskArguments;
  const signer = await getSigner();

  const { vault } = await getContract(hre, symbol);

  log(`About to withdraw all from all strategies`);
  const tx = await vault.connect(signer).withdrawAllFromStrategies();
  await logTxDetails(tx, "withdrawAllFromStrategies");
}

module.exports = {
  allocate,
  capital,
  depositToStrategy,
  mint,
  rebase,
  redeem,
  redeemAll,
  withdrawFromStrategy,
  withdrawAllFromStrategy,
  withdrawAllFromStrategies,
  yieldTask,
};
