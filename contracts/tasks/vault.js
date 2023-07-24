const addresses = require("../utils/addresses");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:vault");

async function getContract(hre, symbol) {
  const contractPrefix = symbol === "OUSD" ? "" : symbol;
  const vaultProxy = await hre.ethers.getContract(
    `${contractPrefix}VaultProxy`
  );
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);

  const oTokenProxy = await ethers.getContract(`${symbol}Proxy`);
  const oToken = await ethers.getContractAt(symbol, oTokenProxy.address);

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
async function yield(taskArguments, hre) {
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
  let usdtBalance = await usdt.balanceOf(vaultProxy.address);
  log("USDT vault balance", usdtUnitsFormat(usdtBalance));
  let vaultValue = await vault.totalValue();
  log("Vault value", ousdUnitsFormat(vaultValue));
  let supply = await oToken.totalSupply();
  log("OUSD supply", ousdUnitsFormat(supply));

  // Transfer 100k USDT to the vault.
  await usdt
    .connect(richSigner)
    .transfer(vaultProxy.address, usdtUnits("100000"));

  usdtBalance = await usdt.balanceOf(vaultProxy.address);
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
  const { isMainnet, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
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
    log(`Governor address: ${governorAddr}`);
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

module.exports = {
  allocate,
  capital,
  rebase,
  yield,
};
