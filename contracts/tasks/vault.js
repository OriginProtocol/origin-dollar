const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { getBlock } = require("./block");
const { resolveAsset } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");
const { ethereumAddress } = require("../utils/regex");
const { getNetworkName } = require("../utils/hardhat-helpers");

const log = require("../utils/logger")("task:vault");

async function getContracts(hre, symbol, assetSymbol) {
  const networkName = await getNetworkName();

  // If no symbol is provided, set to OSonic if Sonic network, else default to OETH
  symbol = symbol ? symbol : networkName === "sonic" ? "OSonic" : "OETH";
  // Convert OS to OSonic
  symbol = symbol === "OS" ? "OSonic" : symbol;
  const contractPrefix = symbol === "OUSD" ? "" : symbol;

  const networkPrefix = networkName === "base" ? "Base" : "";

  // Resolve the vault
  const vaultProxy = await hre.ethers.getContract(
    `${contractPrefix}${networkPrefix}VaultProxy`
  );
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
  log(`Resolved ${networkName} ${symbol} Vault to address ${vault.address}`);

  // Resolve the OToken. eg OUSD, OETH or OSonic
  const oTokenProxy = await ethers.getContract(
    `${symbol}${networkPrefix}Proxy`
  );
  const oToken = await ethers.getContractAt(symbol, oTokenProxy.address);
  log(`Resolved ${networkName} ${symbol} OToken to address ${oToken.address}`);

  // Resolve the wrapped OToken. eg wOETH, wOSonic
  let wOToken;
  if (networkName !== "hoodi") {
    const wOTokenProxy = await ethers.getContract(
      `W${symbol}${networkPrefix}Proxy`
    );
    wOToken = await ethers.getContractAt(`W${symbol}`, wOTokenProxy.address);
  }

  // Resolve the Asset. eg WETH or wS
  // This won't work for OUSD if the assetSymbol has not been set as it has three assets
  assetSymbol = assetSymbol || (networkName === "sonic" ? "wS" : "WETH");
  const asset = await resolveAsset(assetSymbol);
  log(
    `Resolved ${networkName} ${symbol} Vault asset to ${assetSymbol} with address ${asset.address}`
  );

  return {
    vault,
    oToken,
    wOToken,
    asset,
  };
}

async function snapVault({ block }, hre) {
  const blockTag = getBlock(block);

  const { vault, oToken, wOToken, asset } = await getContracts(hre);

  const assetBalance = await asset.balanceOf(vault.address, {
    blockTag,
  });

  const totalSupply = await oToken.totalSupply({
    blockTag,
  });
  const nonRebasingSupply = await oToken.nonRebasingSupply({ blockTag });
  const rebasingSupply = totalSupply.sub(nonRebasingSupply);

  const queue = await vault.withdrawalQueueMetadata({
    blockTag,
  });
  const shortfall = queue.queued.sub(queue.claimable);
  const unclaimed = queue.queued.sub(queue.claimed);
  const available = assetBalance.add(queue.claimed).sub(queue.queued);
  const availablePercentage = available.mul(10000).div(totalSupply);

  const totalAssets = await vault.totalValue({
    blockTag,
  });
  const assetSupplyDiff = totalAssets.sub(totalSupply);
  const vaultBufferPercentage = await vault.vaultBuffer({
    blockTag,
  });
  const vaultBuffer = totalSupply
    .mul(vaultBufferPercentage)
    .div(parseUnits("1"));

  const assetsPerShare = await wOToken.convertToAssets(parseUnits("1"), {
    blockTag,
  });

  console.log(
    `Vault assets        : ${formatUnits(assetBalance)}, ${assetBalance} wei`
  );

  console.log(
    `Queued              : ${formatUnits(queue.queued)}, ${queue.queued} wei`
  );
  console.log(
    `Claimable           : ${formatUnits(queue.claimable)}, ${
      queue.claimable
    } wei`
  );
  console.log(
    `Claimed             : ${formatUnits(queue.claimed)}, ${queue.claimed} wei`
  );
  console.log(
    `Shortfall           : ${formatUnits(shortfall)}, ${shortfall} wei`
  );
  console.log(
    `Unclaimed           : ${formatUnits(unclaimed)}, ${unclaimed} wei`
  );
  console.log(
    `Available           : ${formatUnits(
      available
    )}, ${available} wei, ${formatUnits(availablePercentage, 2)}%`
  );
  console.log(
    `Target Buffer       : ${formatUnits(vaultBuffer)}, ${formatUnits(
      vaultBufferPercentage,
      16
    )}%`
  );

  console.log(
    `Total Asset         : ${formatUnits(totalAssets)}, ${totalAssets} wei`
  );
  console.log(
    `Total Supply        : ${formatUnits(totalSupply)}, ${totalSupply} wei`
  );
  console.log(
    `Asset - Supply      : ${formatUnits(
      assetSupplyDiff
    )}, ${assetSupplyDiff} wei`
  );
  console.log(
    `Non-rebasing supply : ${formatUnits(
      nonRebasingSupply
    )}, ${nonRebasingSupply} wei, ${formatUnits(
      nonRebasingSupply.mul(10000).div(totalSupply),
      2
    )}%`
  );
  console.log(
    `Rebasing supply     : ${formatUnits(
      rebasingSupply
    )}, ${rebasingSupply} wei, ${formatUnits(
      rebasingSupply.mul(10000).div(totalSupply),
      2
    )}%`
  );
  console.log(`Assets per share    : ${formatUnits(assetsPerShare, 18)}`);
  console.log(`last request id     : ${queue.nextWithdrawalIndex - 1}`);
}

async function addWithdrawalQueueLiquidity(_, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre);

  log(
    `About to call addWithdrawalQueueLiquidity() on the vault with address ${vault.address}`
  );
  const tx = await vault.connect(signer).addWithdrawalQueueLiquidity();
  await logTxDetails(tx, "addWithdrawalQueueLiquidity");
}

async function allocate({ symbol }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

  log(
    `About to send a transaction to call allocate() on the ${symbol} vault with address ${vault.address}`
  );
  const tx = await vault.connect(signer).allocate();
  await logTxDetails(tx, "allocate");
}

async function rebase({ symbol }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

  log(
    `About to send a transaction to call rebase() on the ${symbol} vault with address ${vault.address}`
  );
  const tx = await vault.connect(signer).rebase();
  await logTxDetails(tx, "rebase");
}

/**
 * Call the Vault's admin pauseCapital method.
 */
async function capital({ symbol, pause }, hre) {
  const { isMainnet } = require("../test/helpers");
  const { proposeArgs } = require("../utils/governor");

  log("Setting Vault capitalPause to", pause);

  const sGovernor = await getSigner();

  const { vault } = await getContracts(hre, symbol);

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

async function mint({ amount, asset, symbol, min, approve }, hre) {
  const signer = await getSigner();

  const {
    vault,
    oToken,
    asset: cAsset,
  } = await getContracts(hre, symbol, asset);

  const assetUnits = parseUnits(amount.toString(), await cAsset.decimals());
  const minUnits = parseUnits(min.toString());

  if (approve) {
    log(
      `About to approve the ${await oToken.symbol()} Vault to spend ${amount} ${await cAsset.symbol()}`
    );
    const approveTx = await cAsset
      .connect(signer)
      .approve(vault.address, assetUnits);
    await logTxDetails(approveTx, "approve");
  }

  log(
    `About to mint ${await oToken.symbol()} using ${amount} ${await cAsset.symbol()}`
  );
  const tx = await vault
    .connect(signer)
    .mint(cAsset.address, assetUnits, minUnits);
  await logTxDetails(tx, "mint");
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

async function depositToStrategy({ amounts, assets, symbol, strategy }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

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

async function withdrawFromStrategy(
  { amounts, assets, symbol, strategy },
  hre
) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

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

async function withdrawAllFromStrategy({ symbol, strategy }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

  const strategyAddr = await resolveStrategyAddress(strategy, hre);

  log(`About to withdraw all from the ${strategy} strategy`);
  const tx = await vault.connect(signer).withdrawAllFromStrategy(strategyAddr);
  await logTxDetails(tx, "withdrawAllFromStrategy");
}

async function withdrawAllFromStrategies({ symbol }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

  log(`About to withdraw all from all strategies`);
  const tx = await vault.connect(signer).withdrawAllFromStrategies();
  await logTxDetails(tx, "withdrawAllFromStrategies");
}

async function requestWithdrawal({ amount, symbol }, hre) {
  const signer = await getSigner();

  const oTokenUnits = parseUnits(amount.toString());

  const { vault } = await getContracts(hre, symbol);

  // Get the withdrawal request ID by statically calling requestWithdrawal
  const { requestId } = await vault
    .connect(signer)
    .callStatic.requestWithdrawal(oTokenUnits);

  log(`About to request withdrawal from the ${symbol} vault`);
  const tx = await vault.connect(signer).requestWithdrawal(oTokenUnits);
  await logTxDetails(tx, "requestWithdrawal");

  console.log(`Withdrawal request id: ${requestId}`);
}

async function claimWithdrawal({ requestId, symbol }, hre) {
  const signer = await getSigner();

  const { vault } = await getContracts(hre, symbol);

  log(
    `About to claim withdrawal from the ${symbol} vault for request ${requestId}`
  );
  const tx = await vault.connect(signer).claimWithdrawal(requestId);
  await logTxDetails(tx, "claimWithdrawal");
}

module.exports = {
  addWithdrawalQueueLiquidity,
  allocate,
  capital,
  depositToStrategy,
  mint,
  rebase,
  requestWithdrawal,
  claimWithdrawal,
  snapVault,
  withdrawFromStrategy,
  withdrawAllFromStrategy,
  withdrawAllFromStrategies,
};
